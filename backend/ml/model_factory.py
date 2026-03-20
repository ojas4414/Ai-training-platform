from __future__ import annotations

import torch.nn as nn

from backend.ml.assets import TrainingAsset
from backend.ml.train_mnist import SimpleNN


class FlexibleMLP(nn.Module):
    def __init__(
        self,
        input_features: int,
        num_classes: int,
        hidden_size: int = 256,
        n_layers: int = 2,
        dropout: float = 0.3,
        flatten_input: bool = True,
    ):
        super().__init__()

        layers: list[nn.Module] = []
        if flatten_input:
            layers.append(nn.Flatten())

        in_features = input_features
        current_hidden = hidden_size

        for _ in range(n_layers):
            layers.extend(
                [
                    nn.Linear(in_features, current_hidden),
                    nn.BatchNorm1d(current_hidden),
                    nn.ReLU(),
                    nn.Dropout(dropout),
                ]
            )
            in_features = current_hidden
            current_hidden = max(current_hidden // 2, 64)

        layers.append(nn.Linear(in_features, num_classes))
        self.net = nn.Sequential(*layers)

    def forward(self, x):
        return self.net(x)


def _metadata_for_asset(
    asset: TrainingAsset,
    model_family: str,
    model_kwargs: dict,
) -> dict:
    metadata = asset.checkpoint_metadata()
    metadata["model_family"] = model_family
    metadata["model_kwargs"] = model_kwargs
    return metadata


def build_default_model(asset: TrainingAsset) -> tuple[nn.Module, dict]:
    if asset.dataset_kind == "mnist":
        hidden_size = 256
        model = SimpleNN(hidden_size=hidden_size)
        metadata = _metadata_for_asset(
            asset,
            model_family="mnist_simple_nn",
            model_kwargs={"hidden_size": hidden_size},
        )
        return model, metadata

    hidden_size = 256
    n_layers = 2
    dropout = 0.25
    model = FlexibleMLP(
        input_features=asset.feature_count,
        num_classes=asset.num_classes,
        hidden_size=hidden_size,
        n_layers=n_layers,
        dropout=dropout,
        flatten_input=False,
    )
    metadata = _metadata_for_asset(
        asset,
        model_family="flexible_mlp",
        model_kwargs={
            "hidden_size": hidden_size,
            "n_layers": n_layers,
            "dropout": dropout,
            "flatten_input": False,
        },
    )
    return model, metadata


def build_search_model(
    asset: TrainingAsset,
    *,
    hidden_size: int,
    n_layers: int,
    dropout: float,
) -> tuple[nn.Module, dict]:
    model = FlexibleMLP(
        input_features=asset.feature_count,
        num_classes=asset.num_classes,
        hidden_size=hidden_size,
        n_layers=n_layers,
        dropout=dropout,
        flatten_input=(asset.dataset_kind == "mnist"),
    )
    metadata = _metadata_for_asset(
        asset,
        model_family="flexible_mlp",
        model_kwargs={
            "hidden_size": hidden_size,
            "n_layers": n_layers,
            "dropout": dropout,
            "flatten_input": asset.dataset_kind == "mnist",
        },
    )
    return model, metadata


def build_model_from_checkpoint(checkpoint: dict) -> tuple[nn.Module, dict, tuple[int, ...]]:
    metadata = checkpoint.get("checkpoint_metadata") or {}
    model_family = metadata.get("model_family", "mnist_simple_nn")
    model_kwargs = metadata.get("model_kwargs", {})
    input_shape = tuple(metadata.get("input_shape", [1, 28, 28]))

    if model_family == "mnist_simple_nn":
        model = SimpleNN(hidden_size=int(model_kwargs.get("hidden_size", 256)))
        return model, metadata, input_shape

    if model_family == "flexible_mlp":
        feature_count = int(metadata.get("feature_count") or _feature_count_from_input_shape(input_shape))
        num_classes = int(metadata.get("num_classes", 10))
        model = FlexibleMLP(
            input_features=feature_count,
            num_classes=num_classes,
            hidden_size=int(model_kwargs.get("hidden_size", 256)),
            n_layers=int(model_kwargs.get("n_layers", 2)),
            dropout=float(model_kwargs.get("dropout", 0.3)),
            flatten_input=bool(model_kwargs.get("flatten_input", len(input_shape) > 1)),
        )
        return model, metadata, input_shape

    raise ValueError(f"Unsupported checkpoint model family: {model_family}")


def _feature_count_from_input_shape(input_shape: tuple[int, ...]) -> int:
    feature_count = 1
    for dimension in input_shape:
        feature_count *= dimension
    return feature_count
