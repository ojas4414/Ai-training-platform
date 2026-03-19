import json

from fastapi.testclient import TestClient

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
