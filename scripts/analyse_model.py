"""
analyse_model.py — Model Architecture Analyser.
Loads any .pth checkpoint, prints a full layer-by-layer summary,
and saves the analysis as a structured JSON file.
"""
import json
import time
import argparse
import sys
from pathlib import Path

import torch
import torch.nn as nn
from torchsummary import summary as torch_summary
import io
from contextlib import redirect_stdout


def _count_parameters(model: nn.Module):
    total = sum(p.numel() for p in model.parameters())
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    return total, trainable


def _get_layer_info(model: nn.Module):
    layers = []
    for name, module in model.named_modules():
        if name == "":
            continue
        layer_info = {
            "name": name,
            "type": module.__class__.__name__,
            "params": sum(p.numel() for p in module.parameters(recurse=False)),
            "trainable_params": sum(
                p.numel() for p in module.parameters(recurse=False) if p.requires_grad
            ),
        }
        # Add shape info for linear and conv layers
        if isinstance(module, nn.Linear):
            layer_info["in_features"] = module.in_features
            layer_info["out_features"] = module.out_features
        elif isinstance(module, (nn.Conv2d, nn.Conv1d)):
            layer_info["in_channels"] = module.in_channels
            layer_info["out_channels"] = module.out_channels
            layer_info["kernel_size"] = list(module.kernel_size) if hasattr(module.kernel_size, '__iter__') else module.kernel_size
        layers.append(layer_info)
    return layers


def _benchmark_inference(model: nn.Module, input_shape: tuple, device: torch.device, n_runs: int = 200):
    model.eval()
    dummy = torch.randn(1, *input_shape).to(device)

    # Warm up
    with torch.no_grad():
        for _ in range(10):
            _ = model(dummy)

    # Benchmark
    if device.type == "cuda":
        torch.cuda.synchronize()
    start = time.perf_counter()
    with torch.no_grad():
        for _ in range(n_runs):
            _ = model(dummy)
    if device.type == "cuda":
        torch.cuda.synchronize()
    elapsed = time.perf_counter() - start

    avg_ms = (elapsed / n_runs) * 1000
    return round(avg_ms, 4)


def analyse_model(
    model: nn.Module,
    input_shape: tuple = (1, 28, 28),
    checkpoint_path: str = None,
    output_json: str = None,
    device_str: str = "cpu",
) -> dict:
    """
    Analyse a PyTorch model and return a structured dictionary.

    Args:
        model: An nn.Module instance (already instantiated).
        input_shape: Input tensor shape (C, H, W) or (features,).
        checkpoint_path: Path to .pth file for file size measurement.
        output_json: If provided, saves analysis to this JSON path.
        device_str: "cpu" or "cuda".

    Returns:
        dict with keys: model_class, total_params, trainable_params, layers,
                        inference_latency_ms, file_size_mb, input_shape, torchsummary
    """
    device = torch.device(device_str if torch.cuda.is_available() or device_str == "cpu" else "cpu")
    model = model.to(device)
    model.eval()

    total_params, trainable_params = _count_parameters(model)
    layers = _get_layer_info(model)
    latency_ms = _benchmark_inference(model, input_shape, device)

    # Capture torchsummary output
    f = io.StringIO()
    try:
        with redirect_stdout(f):
            torch_summary(model, input_shape, device=device_str)
        summary_text = f.getvalue()
    except Exception as e:
        summary_text = f"Could not generate torchsummary: {e}"

    # Model file size
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
        Path(output_json).parent.mkdir(parents=True, exist_ok=True)
        with open(output_json, "w") as fp:
            json.dump(analysis, fp, indent=2)
        print(f"✅ Analysis saved to {output_json}")

    return analysis


def analyse_from_checkpoint(checkpoint_path: str, model_class, input_shape=(1, 28, 28), output_json=None) -> dict:
    """Load a .pth checkpoint and analyse the model."""
    checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)

    model = model_class()
    state_dict = checkpoint.get("model_state_dict", checkpoint)
    model.load_state_dict(state_dict)

    return analyse_model(
        model,
        input_shape=input_shape,
        checkpoint_path=checkpoint_path,
        output_json=output_json,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Analyse a PyTorch model checkpoint")
    parser.add_argument("checkpoint", help="Path to .pth file")
    parser.add_argument("--output", default="results/model_analysis.json", help="Output JSON path")
    args = parser.parse_args()

    # Import model class from train_mnist
    sys.path.insert(0, str(Path(__file__).parent.parent.parent))
    from backend.ml.train_mnist import SimpleNN

    result = analyse_from_checkpoint(args.checkpoint, SimpleNN, output_json=args.output)

    print(f"\n{'='*50}")
    print(f"Model: {result['model_class']}")
    print(f"Total Parameters: {result['total_params']:,}")
    print(f"Trainable Parameters: {result['trainable_params']:,}")
    print(f"Inference Latency (CPU): {result['inference_latency_ms']} ms")
    if result['file_size_mb']:
        print(f"Model File Size: {result['file_size_mb']} MB")
    print(f"{'='*50}")
