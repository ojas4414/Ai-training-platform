"""
analyse_model.py - Model Architecture Analyser.
Loads a checkpoint, reconstructs the model, and saves a structured summary.
"""

import argparse
import io
import json
import sys
import time
from contextlib import redirect_stdout
from pathlib import Path

import torch
import torch.nn as nn
from torchsummary import summary as torch_summary

sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.ml.model_factory import build_model_from_checkpoint


def _count_parameters(model: nn.Module):
    total = sum(parameter.numel() for parameter in model.parameters())
    trainable = sum(parameter.numel() for parameter in model.parameters() if parameter.requires_grad)
    return total, trainable


def _get_layer_info(model: nn.Module):
    layers = []
    for name, module in model.named_modules():
        if name == "":
            continue

        layer_info = {
            "name": name,
            "type": module.__class__.__name__,
            "params": sum(parameter.numel() for parameter in module.parameters(recurse=False)),
            "trainable_params": sum(
                parameter.numel() for parameter in module.parameters(recurse=False) if parameter.requires_grad
            ),
        }

        if isinstance(module, nn.Linear):
            layer_info["in_features"] = module.in_features
            layer_info["out_features"] = module.out_features
        elif isinstance(module, (nn.Conv2d, nn.Conv1d)):
            layer_info["in_channels"] = module.in_channels
            layer_info["out_channels"] = module.out_channels
            layer_info["kernel_size"] = (
                list(module.kernel_size) if hasattr(module.kernel_size, "__iter__") else module.kernel_size
            )

        layers.append(layer_info)

    return layers


def _benchmark_inference(model: nn.Module, input_shape: tuple, device: torch.device, n_runs: int = 50):
    model.eval()
    dummy = torch.randn(1, *input_shape).to(device)

    with torch.no_grad():
        for _ in range(10):
            _ = model(dummy)

    if device.type == "cuda":
        torch.cuda.synchronize()
    start = time.perf_counter()
    with torch.no_grad():
        for _ in range(n_runs):
            _ = model(dummy)
    if device.type == "cuda":
        torch.cuda.synchronize()

    elapsed = time.perf_counter() - start
    return round((elapsed / n_runs) * 1000, 4)


def analyse_model(
    model: nn.Module,
    input_shape: tuple = (1, 28, 28),
    checkpoint_path: str | None = None,
    output_json: str | None = None,
    device_str: str = "cpu",
    progress_callback=None,
) -> dict:
    device = torch.device(device_str if torch.cuda.is_available() or device_str == "cpu" else "cpu")
    model = model.to(device)
    model.eval()

    if progress_callback is not None:
        progress_callback(progress=10.0, message="Counting model parameters")
    total_params, trainable_params = _count_parameters(model)
    if progress_callback is not None:
        progress_callback(progress=30.0, message="Collecting layer metadata")
    layers = _get_layer_info(model)
    if progress_callback is not None:
        progress_callback(progress=55.0, message="Benchmarking inference latency")
    latency_ms = _benchmark_inference(model, input_shape, device)

    summary_buffer = io.StringIO()
    try:
        if progress_callback is not None:
            progress_callback(progress=75.0, message="Generating torchsummary report")
        with redirect_stdout(summary_buffer):
            torch_summary(model, input_shape, device=device_str)
        summary_text = summary_buffer.getvalue()
    except Exception as exc:
        summary_text = f"Could not generate torchsummary: {exc}"

    file_size_mb = None
    if checkpoint_path and Path(checkpoint_path).exists():
        file_size_mb = round(Path(checkpoint_path).stat().st_size / (1024 * 1024), 4)

    analysis = {
        "model_class": model.__class__.__name__,
        "input_shape": list(input_shape),
        "total_params": total_params,
        "trainable_params": trainable_params,
        "non_trainable_params": total_params - trainable_params,
        "layers": layers,
        "inference_latency_ms": latency_ms,
        "file_size_mb": file_size_mb,
        "torchsummary": summary_text,
    }

    if output_json:
        if progress_callback is not None:
            progress_callback(progress=90.0, message="Saving analysis report")
        Path(output_json).parent.mkdir(parents=True, exist_ok=True)
        with open(output_json, "w") as handle:
            json.dump(analysis, handle, indent=2)

    return analysis


def analyse_from_checkpoint(
    checkpoint_path: str,
    model_class=None,
    input_shape=None,
    output_json=None,
    progress_callback=None,
) -> dict:
    if progress_callback is not None:
        progress_callback(progress=5.0, message="Loading checkpoint from disk")
    checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)

    if model_class is None:
        model, _, inferred_input_shape = build_model_from_checkpoint(checkpoint)
        active_input_shape = tuple(input_shape) if input_shape is not None else inferred_input_shape
    else:
        model = model_class()
        state_dict = checkpoint.get("model_state_dict", checkpoint)
        model.load_state_dict(state_dict)
        active_input_shape = tuple(input_shape)

    return analyse_model(
        model,
        input_shape=active_input_shape,
        checkpoint_path=checkpoint_path,
        output_json=output_json,
        progress_callback=progress_callback,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Analyse a PyTorch model checkpoint")
    parser.add_argument("checkpoint", help="Path to .pth file")
    parser.add_argument("--output", default="results/model_analysis.json", help="Output JSON path")
    arguments = parser.parse_args()

    result = analyse_from_checkpoint(arguments.checkpoint, model_class=None, input_shape=None, output_json=arguments.output)

    print(f"\n{'=' * 50}")
    print(f"Model: {result['model_class']}")
    print(f"Total Parameters: {result['total_params']:,}")
    print(f"Trainable Parameters: {result['trainable_params']:,}")
    print(f"Inference Latency (CPU): {result['inference_latency_ms']} ms")
    if result["file_size_mb"]:
        print(f"Model File Size: {result['file_size_mb']} MB")
    print(f"{'=' * 50}")
