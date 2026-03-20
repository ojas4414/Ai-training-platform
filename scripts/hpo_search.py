"""
hpo_search.py - Optuna hyperparameter optimisation.
Runs N trials, logs each to MLflow, and persists the winning config.
"""

import json
import logging
import sys
from pathlib import Path

import optuna
from optuna.pruners import MedianPruner
from optuna.samplers import TPESampler

sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.ml.assets import TrainingAsset, load_training_asset
from backend.ml.model_factory import build_search_model
from backend.ml.train_engine import TrainEngine

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

optuna.logging.set_verbosity(optuna.logging.WARNING)


def make_objective(asset: TrainingAsset, experiment_name: str):
    def objective(trial: optuna.Trial) -> float:
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
            "dataset_name": asset.dataset_name,
        }

        model, checkpoint_metadata = build_search_model(
            asset,
            hidden_size=hidden_size,
            n_layers=n_layers,
            dropout=dropout,
        )
        engine = TrainEngine(model, asset.dataset, config)

        checkpoint_path = f"models/hpo_trial_{trial.number}.pth"

        try:
            best_val_acc, _ = engine.train(
                experiment_name=experiment_name,
                run_name=f"hpo_trial_{trial.number:03d}",
                checkpoint_path=checkpoint_path,
                trial=trial,
                checkpoint_metadata=checkpoint_metadata,
            )
        except optuna.exceptions.TrialPruned:
            raise

        return best_val_acc

    return objective


def run_hpo(
    n_trials: int = 15,
    n_jobs: int = 2,
    experiment_name: str = "ai-training-platform",
    study_name: str = "mnist-hpo",
    output_path: str = "results/best_hpo_config.json",
    dataset_name: str | None = None,
    progress_callback=None,
):
    effective_n_jobs = max(1, min(n_jobs, n_trials))
    execution_mode = "parallel" if effective_n_jobs > 1 else "sequential"

    try:
        asset = load_training_asset(dataset_name)
    except (FileNotFoundError, ValueError) as exc:
        raise ValueError(str(exc)) from exc

    logger.info(
        "Starting HPO search: %s trials, workers=%s, mode=%s, experiment='%s', dataset='%s'",
        n_trials,
        effective_n_jobs,
        execution_mode,
        experiment_name,
        asset.dataset_name,
    )

    sampler = TPESampler(seed=42)
    pruner = MedianPruner(n_startup_trials=3, n_warmup_steps=3)

    study = optuna.create_study(
        direction="maximize",
        sampler=sampler,
        pruner=pruner,
        study_name=study_name,
    )

    def on_trial_complete(_study: optuna.Study, trial: optuna.trial.FrozenTrial) -> None:
        if progress_callback is None:
            return

        completed_trials = sum(
            1
            for current_trial in _study.trials
            if current_trial.state in {optuna.trial.TrialState.COMPLETE, optuna.trial.TrialState.PRUNED}
        )
        try:
            best_value = _study.best_trial.value
        except ValueError:
            best_value = None
        progress_callback(
            completed_trials=completed_trials,
            total_trials=n_trials,
            trial_number=trial.number,
            best_value=best_value,
            status=trial.state.name.lower(),
        )

    study.optimize(
        make_objective(asset, experiment_name),
        n_trials=n_trials,
        n_jobs=effective_n_jobs,
        show_progress_bar=(effective_n_jobs == 1),
        gc_after_trial=True,
        callbacks=[on_trial_complete],
    )

    best = study.best_trial
    logger.info("\n%s", "=" * 60)
    logger.info("HPO COMPLETE - Best trial #%s", best.number)
    logger.info("  Best val accuracy: %.2f%%", best.value)
    logger.info("  Best params:")
    for key, value in best.params.items():
        logger.info("    %s: %s", key, value)
    logger.info("%s", "=" * 60)

    trials_data = []
    for trial in study.trials:
        if trial.value is not None:
            trials_data.append(
                {
                    "trial": trial.number,
                    "val_accuracy": round(trial.value, 4),
                    **trial.params,
                }
            )

    trials_data.sort(key=lambda item: item["val_accuracy"], reverse=True)

    output = {
        "best_trial": best.number,
        "best_val_accuracy": round(best.value, 4),
        "best_params": best.params,
        "all_trials": trials_data,
        "n_jobs": effective_n_jobs,
        "execution_mode": execution_mode,
        "dataset_name": asset.dataset_name,
        "dataset_kind": asset.dataset_kind,
    }

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as handle:
        json.dump(output, handle, indent=2)
    logger.info("Results saved to %s", output_path)

    return output


if __name__ == "__main__":
    run_hpo(n_trials=15)
