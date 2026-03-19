"""
run_experiments.py — Manual multi-config experiment runner.
Loops over YAML config files, trains a model per config,
saves results to JSON, and logs everything to MLflow.
"""
import json
import sys
import yaml
import torch
import torch.nn as nn
from pathlib import Path
from torchvision import datasets, transforms

sys.path.insert(0, str(Path(__file__).parent.parent))
from backend.ml.train_engine import TrainEngine


class SimpleNN(nn.Module):
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


configs = [
    "configs/config_lr_1.yaml",
    "configs/config_lr_2.yaml",
    "configs/config_lr_3.yaml",
]

transform = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize((0.1307,), (0.3081,)),
])

dataset = datasets.MNIST(root="./data", train=True, download=True, transform=transform)

results = []

for config_path in configs:
    print(f"\n── Running experiment: {config_path}")

    with open(config_path, "r") as f:
        config = yaml.safe_load(f)

    model = SimpleNN()
    engine = TrainEngine(model, dataset, config)

    lr_tag = str(config["learning_rate"]).replace(".", "_")
    checkpoint_path = f"models/exp_lr_{lr_tag}_best.pth"

    best_val_acc, history = engine.train(
        experiment_name="ai-training-platform",
        run_name=f"manual_lr{config['learning_rate']}",
        checkpoint_path=checkpoint_path,
    )

    results.append({
        "learning_rate": config["learning_rate"],
        "batch_size": config["batch_size"],
        "epochs": config["epochs"],
        "best_accuracy": best_val_acc,
    })
    print(f"   ✅ Val accuracy: {best_val_acc:.2f}%")

Path("results").mkdir(exist_ok=True)
with open("results/results.json", "w") as f:
    json.dump(results, f, indent=4)

best_config = max(results, key=lambda x: x["best_accuracy"])
print(f"\n🏆 BEST CONFIG: {best_config}")

with open("results/best_config.json", "w") as f:
    json.dump(best_config, f, indent=4)

print("All results saved!")