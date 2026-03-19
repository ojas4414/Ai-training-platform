"""
hpo_search.py — Optuna hyperparameter optimisation.
Runs N trials, logs each to MLflow, prints best config.
"""
import json
import sys
import logging
from pathlib import Path

import torch
import torch.nn as nn
import optuna
from optuna.samplers import TPESampler
from optuna.pruners import MedianPruner
from torchvision import datasets, transforms

sys.path.insert(0, str(Path(__file__).parent.parent))
from backend.ml.train_engine import TrainEngine

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Silence Optuna's own verbose logging
optuna.logging.set_verbosity(optuna.logging.WARNING)


# ---------------------------------------------------------------------------
# Model factory — parameterised by trial
# ---------------------------------------------------------------------------

class FlexibleNN(nn.Module):
    """
    Configurable feed-forward network for MNIST.
    Architecture is determined by Optuna trial suggestions.
    """

    def __init__(self, hidden_size: int = 256, n_layers: int = 2, dropout: float = 0.3):
        super().__init__()
        layers = [nn.Flatten()]
        in_features = 28 * 28

        for i in range(n_layers):
            layers += [
                nn.Linear(in_features, hidden_size),
                nn.BatchNorm1d(hidden_size),
                nn.ReLU(),
                nn.Dropout(dropout),
            ]
            in_features = hidden_size
            hidden_size = max(hidden_size // 2, 64)  # Pyramid architecture

        layers.append(nn.Linear(in_features, 10))
        self.net = nn.Sequential(*layers)

    def forward(self, x):
        return self.net(x)


# ---------------------------------------------------------------------------
# Dataset (loaded once, shared across all trials)
# ---------------------------------------------------------------------------

def load_dataset():
    transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize((0.1307,), (0.3081,)),
    ])
    return datasets.MNIST(root="./data", train=True, download=True, transform=transform)


# ---------------------------------------------------------------------------
# Optuna objective
# ---------------------------------------------------------------------------

def make_objective(dataset, experiment_name: str):
    def objective(trial: optuna.Trial) -> float:
        # Search space
        lr = trial.suggest_float("learning_rate", 1e-4, 1e-1, log=True)
        batch_size = trial.suggest_categorical("batch_size", [32, 64, 128])
        optimizer_name = trial.suggest_categorical("optimizer", ["adam", "sgd"])
        hidden_size = trial.suggest_categorical("hidden_size", [128, 256, 512])
        n_layers = trial.suggest_int("n_layers", 1, 3)
        dropout = trial.suggest_float("dropout", 0.1, 0.5)
        epochs = trial.suggest_int("epochs", 5, 15)

        config = {
            "learning_rate": lr,
            "batch_size": batch_size,
            "optimizer": optimizer_name,
            "epochs": epochs,
        }

        model = FlexibleNN(hidden_size=hidden_size, n_layers=n_layers, dropout=dropout)

        engine = TrainEngine(model, dataset, config)

        checkpoint_path = f"models/hpo_trial_{trial.number}.pth"

        try:
            best_val_acc, _ = engine.train(
                experiment_name=experiment_name,
                run_name=f"hpo_trial_{trial.number:03d}",
                checkpoint_path=checkpoint_path,
                trial=trial,
            )
        except optuna.exceptions.TrialPruned:
            raise

        return best_val_acc

    return objective


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def run_hpo(
    n_trials: int = 15,
    n_jobs: int = 2,
    experiment_name: str = "ai-training-platform",
    study_name: str = "mnist-hpo",
    output_path: str = "results/best_hpo_config.json",
):
    effective_n_jobs = max(1, min(n_jobs, n_trials))
    execution_mode = "parallel" if effective_n_jobs > 1 else "sequential"

    logger.info(
        f"Starting HPO search: {n_trials} trials, workers={effective_n_jobs}, "
        f"mode={execution_mode}, experiment='{experiment_name}'"
    )

    dataset = load_dataset()

    sampler = TPESampler(seed=42)
    pruner = MedianPruner(n_startup_trials=3, n_warmup_steps=3)

    study = optuna.create_study(
        direction="maximize",
        sampler=sampler,
        pruner=pruner,
        study_name=study_name,
    )

    study.optimize(
        make_objective(dataset, experiment_name),
        n_trials=n_trials,
        n_jobs=effective_n_jobs,
        show_progress_bar=(effective_n_jobs == 1),
        gc_after_trial=True,
    )

    # Results summary
    best = study.best_trial
    logger.info(f"\n{'='*60}")
    logger.info(f"HPO COMPLETE — Best trial #{best.number}")
    logger.info(f"  Best val accuracy: {best.value:.2f}%")
    logger.info(f"  Best params:")
    for k, v in best.params.items():
        logger.info(f"    {k}: {v}")
    logger.info(f"{'='*60}")

    # Build results table
    trials_data = []
    for t in study.trials:
        if t.value is not None:
            trials_data.append({
                "trial": t.number,
                "val_accuracy": round(t.value, 4),
                **t.params,
            })

    # Sort by accuracy descending
    trials_data.sort(key=lambda x: x["val_accuracy"], reverse=True)

    output = {
        "best_trial": best.number,
        "best_val_accuracy": round(best.value, 4),
        "best_params": best.params,
        "all_trials": trials_data,
        "n_jobs": effective_n_jobs,
        "execution_mode": execution_mode,
    }

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)
    logger.info(f"Results saved to {output_path}")

    return output


if __name__ == "__main__":
    run_hpo(n_trials=15)
