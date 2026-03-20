from types import SimpleNamespace

from fastapi.testclient import TestClient

from backend.api import main
from backend.api.main import app


def test_train_endpoint_uses_selected_dataset(monkeypatch, workspace_tmp_path):
    monkeypatch.chdir(workspace_tmp_path)

    captured: dict[str, object] = {}

    fake_asset = SimpleNamespace(
        dataset="dataset-object",
        dataset_name="tiny_dataset.csv",
        dataset_kind="tabular",
    )

    def fake_load_training_asset(dataset_name: str | None = None):
        captured["dataset_name"] = dataset_name
        return fake_asset

    def fake_build_default_model(asset):
        captured["asset_name"] = asset.dataset_name
        return "model-object", {"dataset_name": asset.dataset_name, "dataset_kind": asset.dataset_kind}

    class FakeEngine:
        def __init__(self, model, dataset, config):
            captured["model"] = model
            captured["dataset"] = dataset
            captured["config"] = config

        def train(self, experiment_name, run_name, checkpoint_path, checkpoint_metadata, progress_callback=None):
            captured["experiment_name"] = experiment_name
            captured["run_name"] = run_name
            captured["checkpoint_path"] = checkpoint_path
            captured["checkpoint_metadata"] = checkpoint_metadata
            return 91.25, {
                "train_loss": [0.8, 0.4],
                "train_accuracy": [55.0, 78.0],
                "val_loss": [0.9, 0.5],
                "val_accuracy": [50.0, 91.25],
            }

    monkeypatch.setattr(main, "load_training_asset", fake_load_training_asset)
    monkeypatch.setattr(main, "build_default_model", fake_build_default_model)
    monkeypatch.setattr(main, "validate_train_dataset_name", lambda dataset_name: None)

    import backend.ml.train_engine as train_engine_module

    monkeypatch.setattr(train_engine_module, "TrainEngine", FakeEngine)

    with TestClient(app) as client:
        response = client.post(
            "/train",
            json={
                "learning_rate": 0.001,
                "batch_size": 32,
                "epochs": 2,
                "optimizer": "adam",
                "experiment_name": "tabular-train-test",
                "dataset_name": "tiny_dataset.csv",
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["best_val_accuracy"] == 91.25
    assert payload["dataset_name"] == "tiny_dataset.csv"
    assert payload["dataset_kind"] == "tabular"

    assert captured["dataset_name"] == "tiny_dataset.csv"
    assert captured["asset_name"] == "tiny_dataset.csv"
    assert captured["config"] == {
        "learning_rate": 0.001,
        "batch_size": 32,
        "epochs": 2,
        "optimizer": "adam",
        "dataset_name": "tiny_dataset.csv",
    }
    assert captured["checkpoint_metadata"] == {
        "dataset_name": "tiny_dataset.csv",
        "dataset_kind": "tabular",
    }
