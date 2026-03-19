"""
train_best.py - Train the strongest manual configuration discovered so far.

This script prefers:
1. results/best_config.json when it contains a valid config
2. the best entry inside results/results.json
3. configs/train_config.yaml as a fallback
"""
import json
from pathlib import Path

import yaml
from torchvision import datasets, transforms

from backend.ml.train_engine import TrainEngine
from backend.ml.train_mnist import SimpleNN


RESULTS_PATH = Path("results/results.json")
BEST_CONFIG_PATH = Path("results/best_config.json")
DEFAULT_CONFIG_PATH = Path("configs/train_config.yaml")


def _safe_load_json(path: Path):
    if not path.exists() or path.stat().st_size == 0:
        return None

    with open(path, "r") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return None


def _load_default_config() -> dict:
    with open(DEFAULT_CONFIG_PATH, "r") as f:
        raw = yaml.safe_load(f)

    return {
        "learning_rate": raw.get("learning_rate", 0.001),
        "batch_size": raw.get("batch_size", 64),
        "epochs": raw.get("epochs", 10),
        "optimizer": raw.get("optimizer", "adam"),
        "mlflow_experiment": raw.get("mlflow_experiment", "ai-training-platform"),
    }


def load_best_config() -> tuple[dict, str]:
    default_config = _load_default_config()

    best_config = _safe_load_json(BEST_CONFIG_PATH)
    if isinstance(best_config, dict) and best_config:
        return {
            "learning_rate": best_config.get("learning_rate", default_config["learning_rate"]),
            "batch_size": best_config.get("batch_size", default_config["batch_size"]),
            "epochs": best_config.get("epochs", default_config["epochs"]),
            "optimizer": best_config.get("optimizer", default_config["optimizer"]),
            "mlflow_experiment": default_config["mlflow_experiment"],
        }, str(BEST_CONFIG_PATH)

    results = _safe_load_json(RESULTS_PATH)
    if isinstance(results, list) and results:
        def score(item: dict) -> float:
            return float(item.get("best_accuracy", item.get("val_accuracy", -1)))

        best_result = max(results, key=score)
        return {
            "learning_rate": best_result.get("learning_rate", default_config["learning_rate"]),
            "batch_size": best_result.get("batch_size", default_config["batch_size"]),
            "epochs": best_result.get("epochs", default_config["epochs"]),
            "optimizer": best_result.get("optimizer", default_config["optimizer"]),
            "mlflow_experiment": default_config["mlflow_experiment"],
        }, f"{RESULTS_PATH} (best_accuracy={score(best_result):.2f})"

    return default_config, str(DEFAULT_CONFIG_PATH)


def train_best():
    config, source = load_best_config()
    Path("models").mkdir(exist_ok=True)

    print(f"Using config from: {source}")
    print(
        "Training with "
        f"lr={config['learning_rate']}, "
        f"batch_size={config['batch_size']}, "
        f"epochs={config['epochs']}, "
        f"optimizer={config['optimizer']}"
    )

    transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize((0.1307,), (0.3081,)),
    ])
    dataset = datasets.MNIST(root="./data", train=True, download=True, transform=transform)

    model = SimpleNN()
    engine = TrainEngine(model, dataset, config)

    checkpoint_path = "models/best_model.pth"
    best_acc, _ = engine.train(
        experiment_name=config["mlflow_experiment"],
        run_name="train_best",
        checkpoint_path=checkpoint_path,
    )

    print(f"Best model saved to {checkpoint_path}")
    print(f"Best validation accuracy: {best_acc:.2f}%")
    return best_acc, checkpoint_path


if __name__ == "__main__":
    train_best()
