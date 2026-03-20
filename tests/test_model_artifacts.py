from pathlib import Path

import torch
import torch.nn as nn

from scripts import analyse_model as analyse_model_script
from scripts import export_onnx as export_onnx_script


class DummyModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.linear = nn.Linear(3, 2)

    def forward(self, x):
        return self.linear(x)


def test_analyse_from_checkpoint_uses_inferred_input_shape(monkeypatch):
    captured = {}

    monkeypatch.setattr(
        analyse_model_script.torch,
        "load",
        lambda *args, **kwargs: {"model_state_dict": DummyModel().state_dict()},
    )
    monkeypatch.setattr(
        analyse_model_script,
        "build_model_from_checkpoint",
        lambda checkpoint: (DummyModel(), {}, (3,)),
    )

    def fake_analyse_model(model, input_shape=(1, 28, 28), **kwargs):
        captured["input_shape"] = input_shape
        return {"input_shape": list(input_shape)}

    monkeypatch.setattr(analyse_model_script, "analyse_model", fake_analyse_model)

    result = analyse_model_script.analyse_from_checkpoint("demo_model.pth", output_json=None)

    assert captured["input_shape"] == (3,)
    assert result["input_shape"] == [3]


def test_export_model_uses_legacy_exporter(monkeypatch, workspace_tmp_path):
    monkeypatch.chdir(workspace_tmp_path)

    models_dir = workspace_tmp_path / "models"
    models_dir.mkdir()
    checkpoint_path = models_dir / "demo_model.pth"
    checkpoint_path.write_bytes(b"checkpoint-bytes")

    dummy_model = DummyModel()
    checkpoint = {"model_state_dict": dummy_model.state_dict()}
    export_calls: dict[str, object] = {}

    monkeypatch.setattr(export_onnx_script.torch, "load", lambda *args, **kwargs: checkpoint)
    monkeypatch.setattr(
        export_onnx_script,
        "build_model_from_checkpoint",
        lambda loaded_checkpoint: (DummyModel(), {}, (3,)),
    )
    monkeypatch.setattr(export_onnx_script, "benchmark_pytorch", lambda *args, **kwargs: 1.2)
    monkeypatch.setattr(export_onnx_script, "benchmark_onnx", lambda *args, **kwargs: 0.8)
    monkeypatch.setattr(
        export_onnx_script,
        "quantise_and_benchmark",
        lambda *args, **kwargs: {
            "file_size_mb": 0.01,
            "inference_latency_ms": 0.6,
            "format": "PyTorch INT8 (dynamic quantised)",
            "path": "models/onnx/demo_model_int8.pth",
        },
    )

    def fake_export(*args, **kwargs):
        export_calls["kwargs"] = kwargs
        Path(args[2]).write_bytes(b"onnx-bytes")

    monkeypatch.setattr(export_onnx_script.torch.onnx, "export", fake_export)

    result = export_onnx_script.export_model(str(checkpoint_path))

    assert export_calls["kwargs"]["dynamo"] is False
    assert result["onnx_path"].endswith("demo_model.onnx")
    assert result["quantised"]["path"].endswith("demo_model_int8.pth")
