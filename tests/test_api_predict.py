import torch
from fastapi.testclient import TestClient

from backend.api import main
from backend.api.main import app
from backend.ml.train_mnist import SimpleNN


class FakeMnistDataset:
    def __init__(self, *args, **kwargs):
        self.samples = [
            (torch.zeros(1, 28, 28), 7),
            (torch.ones(1, 28, 28), 3),
        ]

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, index):
        return self.samples[index]


def create_constant_prediction_checkpoint(path, predicted_label: int):
    model = SimpleNN()
    model.eval()

    with torch.no_grad():
        for parameter in model.parameters():
            parameter.zero_()
        model.net[5].bias[predicted_label] = 10

    torch.save({"model_state_dict": model.state_dict()}, path)


def test_predict_endpoint_returns_prediction_payload(monkeypatch, workspace_tmp_path):
    monkeypatch.chdir(workspace_tmp_path)
    monkeypatch.setattr("torchvision.datasets.MNIST", FakeMnistDataset)

    models_dir = workspace_tmp_path / "models"
    models_dir.mkdir()
    checkpoint_path = models_dir / "predictable_model.pth"
    create_constant_prediction_checkpoint(checkpoint_path, predicted_label=7)

    with TestClient(app) as client:
        response = client.post(
            "/predict/predictable_model.pth",
            json={"sample_index": 0, "split": "test", "top_k": 3},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["checkpoint_filename"] == "predictable_model.pth"
    assert payload["sample_index"] == 0
    assert payload["predicted_label"] == 7
    assert payload["true_label"] == 7
    assert payload["matches_label"] is True
    assert len(payload["top_predictions"]) == 3
    assert len(payload["image_pixels"]) == 28
    assert len(payload["image_pixels"][0]) == 28


def test_predict_endpoint_returns_404_for_missing_checkpoint(monkeypatch, workspace_tmp_path):
    monkeypatch.chdir(workspace_tmp_path)
    monkeypatch.setattr("torchvision.datasets.MNIST", FakeMnistDataset)

    with TestClient(app) as client:
        response = client.post(
            "/predict/missing_model.pth",
            json={"sample_index": 0, "split": "test", "top_k": 3},
        )

    assert response.status_code == 404


def test_predict_endpoint_reuses_cached_model_and_dataset(monkeypatch, workspace_tmp_path):
    monkeypatch.chdir(workspace_tmp_path)

    dataset_inits = {"count": 0}

    class CountingMnistDataset(FakeMnistDataset):
        def __init__(self, *args, **kwargs):
            dataset_inits["count"] += 1
            super().__init__(*args, **kwargs)

    original_torch_load = torch.load
    torch_load_calls = {"count": 0}

    def counted_torch_load(*args, **kwargs):
        torch_load_calls["count"] += 1
        return original_torch_load(*args, **kwargs)

    monkeypatch.setattr("torchvision.datasets.MNIST", CountingMnistDataset)
    monkeypatch.setattr(main.torch, "load", counted_torch_load)

    models_dir = workspace_tmp_path / "models"
    models_dir.mkdir()
    checkpoint_path = models_dir / "cached_model.pth"
    create_constant_prediction_checkpoint(checkpoint_path, predicted_label=3)

    with TestClient(app) as client:
        first = client.post(
            "/predict/cached_model.pth",
            json={"sample_index": 1, "split": "test", "top_k": 3},
        )
        second = client.post(
            "/predict/cached_model.pth",
            json={"sample_index": 1, "split": "test", "top_k": 3},
        )

    assert first.status_code == 200
    assert second.status_code == 200
    assert dataset_inits["count"] == 1
    assert torch_load_calls["count"] == 1
