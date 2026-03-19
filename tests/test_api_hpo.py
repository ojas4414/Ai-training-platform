from fastapi.testclient import TestClient

from backend.api.main import app


def test_hpo_endpoint_forwards_parallel_worker_count(monkeypatch, workspace_tmp_path):
    monkeypatch.chdir(workspace_tmp_path)

    import scripts.hpo_search as hpo_search

    captured = {}

    def fake_run_hpo(n_trials: int, n_jobs: int, experiment_name: str, **kwargs):
        captured["n_trials"] = n_trials
        captured["n_jobs"] = n_jobs
        captured["experiment_name"] = experiment_name
        return {
            "best_trial": 2,
            "best_val_accuracy": 98.76,
            "best_params": {"learning_rate": 0.001, "batch_size": 64},
            "all_trials": [],
            "n_jobs": n_jobs,
            "execution_mode": "parallel" if n_jobs > 1 else "sequential",
        }

    monkeypatch.setattr(hpo_search, "run_hpo", fake_run_hpo)

    with TestClient(app) as client:
        response = client.post(
            "/hpo",
            json={
                "n_trials": 6,
                "n_jobs": 3,
                "experiment_name": "parallel-hpo-test",
            },
        )

    assert response.status_code == 200
    assert captured == {
        "n_trials": 6,
        "n_jobs": 3,
        "experiment_name": "parallel-hpo-test",
    }
    payload = response.json()
    assert payload["n_jobs"] == 3
    assert payload["execution_mode"] == "parallel"
