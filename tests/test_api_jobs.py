import time

import pytest
from fastapi.testclient import TestClient

from backend.api import main
from backend.api.main import app


def wait_for_job(client: TestClient, job_id: str) -> dict:
    deadline = time.time() + 5
    while time.time() < deadline:
        response = client.get(f"/jobs/{job_id}")
        assert response.status_code == 200
        payload = response.json()
        if payload["status"] in {"completed", "failed"}:
            return payload
        time.sleep(0.02)

    raise AssertionError(f"Job {job_id} did not finish in time")


def test_train_job_endpoint_returns_completed_result(monkeypatch, workspace_tmp_path):
    monkeypatch.chdir(workspace_tmp_path)
    monkeypatch.setattr(main, "validate_train_dataset_name", lambda dataset_name: None)
    monkeypatch.setattr(
        main,
        "execute_train_request",
        lambda request, job_context=None: {
            "best_val_accuracy": 91.25,
            "run_name": "job-train-run",
            "checkpoint_path": "models/job-train-run.pth",
            "history": {
                "train_loss": [0.8, 0.4],
                "train_accuracy": [55.0, 78.0],
                "val_loss": [0.9, 0.5],
                "val_accuracy": [50.0, 91.25],
            },
            "dataset_name": request.dataset_name or "mnist",
            "dataset_kind": "tabular" if request.dataset_name else "mnist",
        },
    )

    with TestClient(app) as client:
        response = client.post(
            "/train/jobs",
            json={
                "learning_rate": 0.001,
                "batch_size": 32,
                "epochs": 2,
                "optimizer": "adam",
                "experiment_name": "job-train-test",
                "dataset_name": "tiny_dataset.csv",
            },
        )

        assert response.status_code == 202
        queued = response.json()
        assert queued["kind"] == "train"

        completed = wait_for_job(client, queued["job_id"])

    assert completed["status"] == "completed"
    assert completed["result"]["dataset_name"] == "tiny_dataset.csv"
    assert completed["result"]["best_val_accuracy"] == 91.25


def test_hpo_job_endpoint_returns_completed_result(monkeypatch, workspace_tmp_path):
    monkeypatch.chdir(workspace_tmp_path)
    monkeypatch.setattr(main, "validate_train_dataset_name", lambda dataset_name: None)
    monkeypatch.setattr(
        main,
        "execute_hpo_request",
        lambda request, job_context=None: {
            "best_trial": 2,
            "best_val_accuracy": 98.76,
            "best_params": {"learning_rate": 0.001, "batch_size": 64},
            "all_trials": [],
            "n_jobs": request.n_jobs,
            "execution_mode": "parallel" if request.n_jobs > 1 else "sequential",
            "dataset_name": request.dataset_name,
            "dataset_kind": "tabular" if request.dataset_name else "mnist",
        },
    )

    with TestClient(app) as client:
        response = client.post(
            "/hpo/jobs",
            json={
                "n_trials": 6,
                "n_jobs": 3,
                "experiment_name": "job-hpo-test",
                "dataset_name": "tiny_dataset.csv",
            },
        )

        assert response.status_code == 202
        queued = response.json()
        assert queued["kind"] == "hpo"

        completed = wait_for_job(client, queued["job_id"])

    assert completed["status"] == "completed"
    assert completed["result"]["n_jobs"] == 3
    assert completed["result"]["dataset_name"] == "tiny_dataset.csv"


@pytest.mark.parametrize(
    ("path", "helper_name", "expected_kind", "expected_key"),
    [
        ("/analyse/demo_model.pth/jobs", "execute_analysis_request", "analyse", "model_class"),
        ("/export/demo_model.pth/jobs", "execute_export_request", "export", "onnx_path"),
    ],
)
def test_model_job_endpoints_complete(monkeypatch, workspace_tmp_path, path, helper_name, expected_kind, expected_key):
    monkeypatch.chdir(workspace_tmp_path)
    models_dir = workspace_tmp_path / "models"
    models_dir.mkdir()
    (models_dir / "demo_model.pth").write_bytes(b"checkpoint-bytes")
    monkeypatch.setattr(
        main,
        helper_name,
        lambda checkpoint_filename, job_context=None: {
            expected_key: checkpoint_filename,
        },
    )

    with TestClient(app) as client:
        response = client.post(path)
        assert response.status_code == 202
        queued = response.json()
        assert queued["kind"] == expected_kind

        completed = wait_for_job(client, queued["job_id"])

    assert completed["status"] == "completed"
    assert completed["result"][expected_key] == "demo_model.pth"


def test_job_status_endpoint_returns_404_for_unknown_job(monkeypatch, workspace_tmp_path):
    monkeypatch.chdir(workspace_tmp_path)

    with TestClient(app) as client:
        response = client.get("/jobs/missing-job")

    assert response.status_code == 404


def test_model_job_endpoint_returns_404_before_queueing_missing_checkpoint(monkeypatch, workspace_tmp_path):
    monkeypatch.chdir(workspace_tmp_path)

    with TestClient(app) as client:
        response = client.post("/analyse/missing_model.pth/jobs")

    assert response.status_code == 404


def test_train_job_endpoint_rejects_non_trainable_dataset(monkeypatch, workspace_tmp_path):
    monkeypatch.chdir(workspace_tmp_path)
    uploads_dir = workspace_tmp_path / "data" / "uploads"
    uploads_dir.mkdir(parents=True)
    (uploads_dir / "bundle.zip").write_bytes(b"fake-zip")

    with TestClient(app) as client:
        response = client.post(
            "/train/jobs",
            json={
                "learning_rate": 0.001,
                "batch_size": 32,
                "epochs": 2,
                "optimizer": "adam",
                "experiment_name": "invalid-dataset-test",
                "dataset_name": "bundle.zip",
            },
        )

    assert response.status_code == 400
    assert "trainable" in response.json()["detail"]
