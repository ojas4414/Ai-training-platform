import logging
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, random_split
import mlflow
import mlflow.pytorch

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


class TrainEngine:
    """
    Core training engine. Accepts any nn.Module + dataset + config dict.
    Runs a full training loop with optional validation, checkpointing,
    and MLflow experiment tracking.
    """

    def __init__(self, model: nn.Module, train_dataset, config: dict):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info(f"Using device: {self.device}")

        self.model = model.to(self.device)

        if len(train_dataset) < 2:
            raise ValueError("Training dataset must contain at least 2 samples")

        # Split dataset into train / validation (80/20)
        val_size = max(1, int(0.2 * len(train_dataset)))
        train_size = len(train_dataset) - val_size
        if train_size < 1:
            train_size = len(train_dataset) - 1
            val_size = 1

        train_subset, val_subset = random_split(
            train_dataset, [train_size, val_size],
            generator=torch.Generator().manual_seed(42)
        )

        self.train_loader = DataLoader(
            train_subset,
            batch_size=config["batch_size"],
            shuffle=True,
            num_workers=0,
            pin_memory=(self.device.type == "cuda"),
        )
        self.val_loader = DataLoader(
            val_subset,
            batch_size=config["batch_size"],
            shuffle=False,
            num_workers=0,
            pin_memory=(self.device.type == "cuda"),
        )

        self.epochs = config["epochs"]
        self.lr = config["learning_rate"]
        self.config = config

        optimizer_name = config.get("optimizer", "adam").lower()
        if optimizer_name == "sgd":
            self.optimizer = optim.SGD(
                self.model.parameters(), lr=self.lr, momentum=0.9, weight_decay=1e-4
            )
        else:
            self.optimizer = optim.Adam(
                self.model.parameters(), lr=self.lr, weight_decay=1e-4
            )

        self.criterion = nn.CrossEntropyLoss()
        self.scheduler = optim.lr_scheduler.CosineAnnealingLR(
            self.optimizer, T_max=self.epochs
        )

        self.history = {
            "train_loss": [],
            "train_accuracy": [],
            "val_loss": [],
            "val_accuracy": [],
        }

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _run_epoch(self, loader, train: bool):
        self.model.train(train)
        total_loss, correct, total = 0.0, 0, 0

        with torch.set_grad_enabled(train):
            for images, labels in loader:
                images, labels = images.to(self.device), labels.to(self.device)
                outputs = self.model(images)
                loss = self.criterion(outputs, labels)

                if train:
                    self.optimizer.zero_grad()
                    loss.backward()
                    self.optimizer.step()

                total_loss += loss.item()
                _, predicted = torch.max(outputs, 1)
                total += labels.size(0)
                correct += (predicted == labels).sum().item()

        avg_loss = total_loss / len(loader)
        accuracy = 100.0 * correct / total
        return avg_loss, accuracy

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def train(
        self,
        experiment_name: str = "default",
        run_name: str = None,
        checkpoint_path: str = None,
        trial=None,
        checkpoint_metadata: dict | None = None,
        progress_callback=None,
    ):
        """
        Run the full training loop.

        Args:
            experiment_name: MLflow experiment name.
            run_name: Optional MLflow run name.
            checkpoint_path: Where to save the best model checkpoint (.pth).
            trial: Optuna trial object for pruning (optional).

        Returns:
            best_val_accuracy (float), history (dict)
        """
        mlflow.set_experiment(experiment_name)

        with mlflow.start_run(run_name=run_name):
            # Log all hyperparameters
            mlflow.log_params({
                "learning_rate": self.lr,
                "batch_size": self.config["batch_size"],
                "epochs": self.epochs,
                "optimizer": self.config.get("optimizer", "adam"),
                "dataset_name": self.config.get("dataset_name", "mnist"),
                "device": str(self.device),
            })

            best_val_accuracy = 0.0
            best_model_state = None

            for epoch in range(1, self.epochs + 1):
                train_loss, train_acc = self._run_epoch(self.train_loader, train=True)
                val_loss, val_acc = self._run_epoch(self.val_loader, train=False)
                self.scheduler.step()

                # Store history
                self.history["train_loss"].append(train_loss)
                self.history["train_accuracy"].append(train_acc)
                self.history["val_loss"].append(val_loss)
                self.history["val_accuracy"].append(val_acc)

                # Log to MLflow
                mlflow.log_metrics(
                    {
                        "train_loss": train_loss,
                        "train_accuracy": train_acc,
                        "val_loss": val_loss,
                        "val_accuracy": val_acc,
                    },
                    step=epoch,
                )

                logger.info(
                    f"Epoch {epoch:02d}/{self.epochs} | "
                    f"Train Loss: {train_loss:.4f} Acc: {train_acc:.2f}% | "
                    f"Val Loss: {val_loss:.4f} Acc: {val_acc:.2f}%"
                )

                if progress_callback is not None:
                    progress_callback(
                        epoch=epoch,
                        total_epochs=self.epochs,
                        train_loss=train_loss,
                        train_accuracy=train_acc,
                        val_loss=val_loss,
                        val_accuracy=val_acc,
                    )

                # Track best model
                if val_acc > best_val_accuracy:
                    best_val_accuracy = val_acc
                    best_model_state = {k: v.cpu().clone() for k, v in self.model.state_dict().items()}

                # Optuna pruning support
                if trial is not None:
                    trial.report(val_acc, epoch)
                    if trial.should_prune():
                        mlflow.log_metric("pruned", 1)
                        logger.info(f"Trial pruned at epoch {epoch}")
                        import optuna
                        raise optuna.exceptions.TrialPruned()

            # Save best checkpoint
            if best_model_state is not None and checkpoint_path:
                self.model.load_state_dict(best_model_state)
                torch.save(
                    {
                        "model_state_dict": best_model_state,
                        "config": self.config,
                        "best_val_accuracy": best_val_accuracy,
                        "history": self.history,
                        "checkpoint_metadata": checkpoint_metadata or {},
                    },
                    checkpoint_path,
                )
                mlflow.log_artifact(checkpoint_path)
                logger.info(f"Best model saved to {checkpoint_path} (val acc: {best_val_accuracy:.2f}%)")

            mlflow.log_metric("best_val_accuracy", best_val_accuracy)
            logger.info(f"Training complete. Best validation accuracy: {best_val_accuracy:.2f}%")

        return best_val_accuracy, self.history
