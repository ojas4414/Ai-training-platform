"""
train_mnist.py — MNIST training entry point.
Uses TrainEngine with MLflow tracking.
"""
import torch
import torch.nn as nn
import yaml
from torchvision import datasets, transforms

from backend.ml.train_engine import TrainEngine


class SimpleNN(nn.Module):
    """Lightweight 2-layer fully connected network for MNIST."""

    def __init__(self, hidden_size: int = 256):
        super().__init__()
        self.net = nn.Sequential(
            nn.Flatten(),
            nn.Linear(28 * 28, hidden_size),
            nn.BatchNorm1d(hidden_size),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(hidden_size, 10),
        )

    def forward(self, x):
        return self.net(x)


def train(config_path: str = "configs/train_config.yaml"):
    with open(config_path, "r") as f:
        config = yaml.safe_load(f)

    transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize((0.1307,), (0.3081,)),
    ])

    dataset = datasets.MNIST(
        root="./data", train=True, download=True, transform=transform
    )

    model = SimpleNN()

    engine = TrainEngine(model, dataset, config)

    lr_tag = str(config["learning_rate"]).replace(".", "_")
    checkpoint_path = f"models/mnist_best_{lr_tag}.pth"

    best_acc, history = engine.train(
        experiment_name=config.get("mlflow_experiment", "ai-training-platform"),
        run_name=f"mnist_lr{config['learning_rate']}",
        checkpoint_path=checkpoint_path,
    )

    print(f"\n✅ Training complete. Best val accuracy: {best_acc:.2f}%")
    return best_acc, history


if __name__ == "__main__":
    train()
