from fastapi.testclient import TestClient

from backend.api import main
from backend.api.main import app


def test_model_upload_and_list_flow(monkeypatch, workspace_tmp_path):
    monkeypatch.chdir(workspace_tmp_path)

    with TestClient(app) as client:
        upload_response = client.post(
            "/models/upload",
            files={"file": ("demo_model.pth", b"checkpoint-bytes", "application/octet-stream")},
        )
        list_response = client.get("/models")

    assert upload_response.status_code == 201
    payload = upload_response.json()
    assert payload["message"] == "Model uploaded successfully"
    assert payload["model"]["filename"] == "demo_model.pth"

    assert list_response.status_code == 200
    models_payload = list_response.json()
    assert len(models_payload["models"]) == 1
    assert models_payload["models"][0]["filename"] == "demo_model.pth"


def test_dataset_upload_and_preview_flow(monkeypatch, workspace_tmp_path):
    monkeypatch.chdir(workspace_tmp_path)
    dataset_bytes = b"feature_a,feature_b,label\n1,2,cat\n3,4,dog\n"

    with TestClient(app) as client:
        upload_response = client.post(
            "/datasets/upload",
            files={"file": ("tiny_dataset.csv", dataset_bytes, "text/csv")},
        )
        list_response = client.get("/datasets")

    assert upload_response.status_code == 201
    payload = upload_response.json()
    assert payload["message"] == "Dataset uploaded successfully"
    assert payload["dataset"]["filename"] == "tiny_dataset.csv"
    assert payload["dataset"]["preview"]["kind"] == "table"
    assert payload["dataset"]["preview"]["columns"] == ["feature_a", "feature_b", "label"]

    assert list_response.status_code == 200
    datasets_payload = list_response.json()
    assert len(datasets_payload["datasets"]) == 1
    assert datasets_payload["datasets"][0]["filename"] == "tiny_dataset.csv"


def test_model_upload_rejects_unsupported_extension(monkeypatch, workspace_tmp_path):
    monkeypatch.chdir(workspace_tmp_path)

    with TestClient(app) as client:
        response = client.post(
            "/models/upload",
            files={"file": ("notes.txt", b"not-a-model", "text/plain")},
        )

    assert response.status_code == 400
    assert "Unsupported model file type" in response.json()["detail"]


def test_dataset_list_reuses_cached_previews(monkeypatch, workspace_tmp_path):
    monkeypatch.chdir(workspace_tmp_path)
    uploads_dir = workspace_tmp_path / "data" / "uploads"
    uploads_dir.mkdir(parents=True)
    dataset_path = uploads_dir / "tiny_dataset.csv"
    dataset_path.write_text("feature_a,feature_b,label\n1,2,cat\n3,4,dog\n", encoding="utf-8")

    preview_calls = {"count": 0}

    def fake_build_dataset_preview(path):
        preview_calls["count"] += 1
        return {
            "kind": "table",
            "summary": f"Preview for {path.name}",
            "columns": ["feature_a", "feature_b", "label"],
            "sample_rows": [{"feature_a": "1", "feature_b": "2", "label": "cat"}],
        }

    monkeypatch.setattr(main, "build_dataset_preview_payload", fake_build_dataset_preview)

    with TestClient(app) as client:
        first = client.get("/datasets")
        second = client.get("/datasets")

    assert first.status_code == 200
    assert second.status_code == 200
    assert preview_calls["count"] == 1
