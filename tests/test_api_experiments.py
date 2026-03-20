import json
from types import SimpleNamespace

from fastapi.testclient import TestClient

from backend.api import main
from backend.api.main import app


def test_experiments_endpoint_returns_empty_defaults(monkeypatch, workspace_tmp_path):
    monkeypatch.chdir(workspace_tmp_path)

    with TestClient(app) as client:
        response = client.get("/experiments")

    assert response.status_code == 200
    assert response.json() == {
        "manual_experiments": [],
        "hpo_results": None,
    }


def test_experiments_endpoint_reads_saved_files(monkeypatch, workspace_tmp_path):
    monkeypatch.chdir(workspace_tmp_path)
    results_dir = workspace_tmp_path / "results"
    results_dir.mkdir()

    manual_results = [
        {
            "learning_rate": 0.001,
            "batch_size": 64,
            "epochs": 5,
            "best_accuracy": 98.18,
        }
    ]
    hpo_results = {
        "best_trial": 3,
        "best_val_accuracy": 98.91,
        "best_params": {"learning_rate": 0.001, "batch_size": 64},
        "all_trials": [],
    }

    (results_dir / "results.json").write_text(json.dumps(manual_results), encoding="utf-8")
    (results_dir / "best_hpo_config.json").write_text(json.dumps(hpo_results), encoding="utf-8")

    with TestClient(app) as client:
        response = client.get("/experiments")

    assert response.status_code == 200
    payload = response.json()
    assert payload["manual_experiments"] == manual_results
    assert payload["hpo_results"] == hpo_results


def test_mlflow_runs_endpoint_paginates_and_sorts(monkeypatch, workspace_tmp_path):
    monkeypatch.chdir(workspace_tmp_path)

    class FakeMlflowClient:
        def search_experiments(self):
            return [
                SimpleNamespace(experiment_id="exp-1", name="Experiment A"),
                SimpleNamespace(experiment_id="exp-2", name="Experiment B"),
            ]

        def search_runs(self, experiment_ids, order_by, max_results):
            experiment_id = experiment_ids[0]
            assert order_by == ["metrics.best_val_accuracy DESC"]
            assert max_results >= 50
            if experiment_id == "exp-1":
                return [
                    SimpleNamespace(
                        info=SimpleNamespace(run_id="run-1", run_name="Run 1", status="FINISHED", start_time=100),
                        data=SimpleNamespace(params={"optimizer": "adam"}, metrics={"best_val_accuracy": 96.1}),
                    ),
                    SimpleNamespace(
                        info=SimpleNamespace(run_id="run-2", run_name="Run 2", status="FINISHED", start_time=300),
                        data=SimpleNamespace(params={"optimizer": "sgd"}, metrics={"best_val_accuracy": 97.2}),
                    ),
                ]
            return [
                SimpleNamespace(
                    info=SimpleNamespace(run_id="run-3", run_name="Run 3", status="RUNNING", start_time=200),
                    data=SimpleNamespace(params={"optimizer": "adam"}, metrics={"best_val_accuracy": 95.4}),
                )
            ]

    monkeypatch.setattr(main.mlflow.tracking, "MlflowClient", lambda: FakeMlflowClient())

    with TestClient(app) as client:
        response = client.get("/experiments/mlflow?limit=2&offset=1")

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 3
    assert payload["limit"] == 2
    assert payload["offset"] == 1
    assert payload["has_more"] is False
    assert [run["run_id"] for run in payload["runs"]] == ["run-3", "run-1"]
