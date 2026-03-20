from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from pathlib import Path

import torch
from torch.utils.data import Dataset
from torchvision import datasets, transforms

DATASET_UPLOADS_DIR = Path("data/uploads")
TABULAR_EXTENSIONS = {".csv", ".tsv", ".json"}
LABEL_COLUMN_CANDIDATES = ("label", "target", "class", "y")


class TabularClassificationDataset(Dataset):
    def __init__(self, features: torch.Tensor, labels: torch.Tensor):
        self.features = features
        self.labels = labels

    def __len__(self) -> int:
        return self.features.shape[0]

    def __getitem__(self, index: int) -> tuple[torch.Tensor, torch.Tensor]:
        return self.features[index], self.labels[index]


@dataclass(slots=True)
class TrainingAsset:
    dataset: Dataset
    dataset_name: str
    dataset_kind: str
    input_shape: tuple[int, ...]
    feature_count: int
    num_classes: int
    label_names: list[str]
    summary: str
    supports_sample_prediction: bool = False

    def checkpoint_metadata(self) -> dict:
        return {
            "dataset_name": self.dataset_name,
            "dataset_kind": self.dataset_kind,
            "input_shape": list(self.input_shape),
            "feature_count": self.feature_count,
            "num_classes": self.num_classes,
            "label_names": self.label_names,
            "summary": self.summary,
            "supports_sample_prediction": self.supports_sample_prediction,
        }


def _read_tabular_records(path: Path) -> list[dict]:
    suffix = path.suffix.lower()

    if suffix in {".csv", ".tsv"}:
        delimiter = "," if suffix == ".csv" else "\t"
        with path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle, delimiter=delimiter)
            return [dict(row) for row in reader]

    if suffix == ".json":
        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)

        if isinstance(payload, list):
            if not all(isinstance(item, dict) for item in payload):
                raise ValueError("JSON dataset must be a list of objects")
            return payload

        if isinstance(payload, dict) and isinstance(payload.get("records"), list):
            records = payload["records"]
            if not all(isinstance(item, dict) for item in records):
                raise ValueError("JSON records must contain objects only")
            return records

        raise ValueError("JSON dataset must be a list of objects or contain a top-level 'records' array")

    raise ValueError(f"Unsupported dataset format: {suffix}")


def _choose_label_column(columns: list[str]) -> str:
    for candidate in LABEL_COLUMN_CANDIDATES:
        if candidate in columns:
            return candidate

    return columns[-1]


def _build_tabular_dataset(path: Path) -> TrainingAsset:
    records = _read_tabular_records(path)
    if len(records) < 2:
        raise ValueError("Dataset must contain at least 2 rows")

    columns = list(records[0].keys())
    if len(columns) < 2:
        raise ValueError("Dataset must contain at least one feature column and one label column")

    label_column = _choose_label_column(columns)
    feature_columns = [column for column in columns if column != label_column]
    if not feature_columns:
        raise ValueError("Dataset must contain at least one numeric feature column")

    features: list[list[float]] = []
    raw_labels: list[str] = []

    for row_index, row in enumerate(records, start=1):
        feature_row: list[float] = []
        for column in feature_columns:
            value = row.get(column)
            try:
                feature_row.append(float(value))
            except (TypeError, ValueError) as exc:
                raise ValueError(
                    f"Column '{column}' must contain numeric values. Problem at row {row_index}"
                ) from exc

        label_value = row.get(label_column)
        if label_value in {None, ""}:
            raise ValueError(f"Label column '{label_column}' cannot be empty")

        features.append(feature_row)
        raw_labels.append(str(label_value))

    label_names = list(dict.fromkeys(raw_labels))
    label_map = {label: index for index, label in enumerate(label_names)}

    feature_tensor = torch.tensor(features, dtype=torch.float32)
    feature_mean = feature_tensor.mean(dim=0)
    feature_std = feature_tensor.std(dim=0, unbiased=False)
    feature_std = torch.where(feature_std == 0, torch.ones_like(feature_std), feature_std)
    feature_tensor = (feature_tensor - feature_mean) / feature_std

    label_tensor = torch.tensor([label_map[label] for label in raw_labels], dtype=torch.long)

    dataset = TabularClassificationDataset(feature_tensor, label_tensor)
    return TrainingAsset(
        dataset=dataset,
        dataset_name=path.name,
        dataset_kind="tabular",
        input_shape=(len(feature_columns),),
        feature_count=len(feature_columns),
        num_classes=len(label_names),
        label_names=label_names,
        summary=f"Tabular classification dataset with {len(feature_columns)} features and {len(label_names)} classes",
    )


def load_training_asset(dataset_name: str | None = None) -> TrainingAsset:
    if not dataset_name or dataset_name == "mnist":
        transform = transforms.Compose(
            [
                transforms.ToTensor(),
                transforms.Normalize((0.1307,), (0.3081,)),
            ]
        )
        dataset = datasets.MNIST(root="./data", train=True, download=True, transform=transform)
        return TrainingAsset(
            dataset=dataset,
            dataset_name="mnist",
            dataset_kind="mnist",
            input_shape=(1, 28, 28),
            feature_count=28 * 28,
            num_classes=10,
            label_names=[str(index) for index in range(10)],
            summary="Built-in MNIST handwritten digits dataset",
            supports_sample_prediction=True,
        )

    candidate = Path(dataset_name).name
    path = (DATASET_UPLOADS_DIR / candidate).resolve()
    if path.parent != DATASET_UPLOADS_DIR.resolve() or not path.exists():
        raise FileNotFoundError(f"Dataset '{candidate}' was not found")

    if path.suffix.lower() == ".zip":
        raise ValueError("ZIP datasets are uploadable for storage, but only CSV, TSV, and JSON files are trainable right now")

    if path.suffix.lower() not in TABULAR_EXTENSIONS:
        raise ValueError("Only CSV, TSV, and JSON datasets are trainable right now")

    return _build_tabular_dataset(path)
