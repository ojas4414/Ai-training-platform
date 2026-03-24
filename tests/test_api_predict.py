import base64
import io
import torch
from PIL import Image
from fastapi.testclient import TestClient

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

def test_predict_endpoint_with_image_upload_auto_inversion(monkeypatch, workspace_tmp_path):
    monkeypatch.chdir(workspace_tmp_path)
    
    # Create models dir and a dummy model
    models_dir = workspace_tmp_path / "models"
    models_dir.mkdir()
    checkpoint_path = models_dir / "upload_test_model.pth"
    create_constant_prediction_checkpoint(checkpoint_path, predicted_label=3)
    
    # Create a white background image (255) with a few black pixels (0)
    # This should trigger auto-inversion because mean > 0.5
    img = Image.new('L', (28, 28), color=255)
    # Draw a "3" roughly
    for y in range(5, 23):
        img.putpixel((14, y), 0) # vertical line hack
        
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    
    with TestClient(app) as client:
        response = client.post(
            "/predict/upload_test_model.pth",
            json={
                "image_base64": f"data:image/png;base64,{img_str}",
                "top_k": 3
            },
        )
        
    assert response.status_code == 200
    payload = response.json()
    assert payload["sample_index"] is None
    assert payload["predicted_label"] == 3
    assert payload["true_label"] == -1
    assert payload["matches_label"] is True
    # Verify image_pixels is returned (28x28)
    assert len(payload["image_pixels"]) == 28
