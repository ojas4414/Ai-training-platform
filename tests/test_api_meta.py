from fastapi.testclient import TestClient

from backend.api.main import app


def test_health_endpoint_returns_expected_shape(monkeypatch, workspace_tmp_path):
    monkeypatch.chdir(workspace_tmp_path)

    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["mlflow_tracking_uri"] == "mlruns"
    assert payload["device"] in {"cpu", "cuda"}


def test_health_endpoint_uses_env_tracking_uri(monkeypatch, workspace_tmp_path):
    monkeypatch.chdir(workspace_tmp_path)
    monkeypatch.setenv("MLFLOW_TRACKING_URI", "custom-mlruns")

    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["mlflow_tracking_uri"] == "custom-mlruns"
    assert (workspace_tmp_path / "custom-mlruns").exists()


def test_lifespan_creates_runtime_directories(monkeypatch, workspace_tmp_path):
    monkeypatch.chdir(workspace_tmp_path)

    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert (workspace_tmp_path / "mlruns").exists()
    assert (workspace_tmp_path / "data").exists()
    assert (workspace_tmp_path / "models").exists()
    assert (workspace_tmp_path / "results").exists()
