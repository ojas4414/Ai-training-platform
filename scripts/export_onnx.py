"""
export_onnx.py - Export a trained PyTorch model to ONNX format.
Benchmarks size and inference latency for .pth, .onnx, and INT8-quantised models.
"""

import json
import sys
import time
from pathlib import Path

import numpy as np
import torch

sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.ml.model_factory import build_model_from_checkpoint


def benchmark_onnx(onnx_path: str, input_shape=(1, 28, 28), n_runs: int = 50) -> float:
    try:
        import onnxruntime as ort

        session = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
        dummy = np.random.randn(1, *input_shape).astype(np.float32)
        input_name = session.get_inputs()[0].name

        for _ in range(10):
            session.run(None, {input_name: dummy})

        start = time.perf_counter()
        for _ in range(n_runs):
            session.run(None, {input_name: dummy})
        elapsed = time.perf_counter() - start
        return round((elapsed / n_runs) * 1000, 4)
    except Exception:
        return -1.0


def benchmark_pytorch(model: torch.nn.Module, input_shape=(1, 28, 28), n_runs: int = 50) -> float:
    model.eval()
    dummy = torch.randn(1, *input_shape)

    with torch.no_grad():
        for _ in range(10):
            _ = model(dummy)

    start = time.perf_counter()
    with torch.no_grad():
        for _ in range(n_runs):
            _ = model(dummy)
    elapsed = time.perf_counter() - start
    return round((elapsed / n_runs) * 1000, 4)


def quantise_and_benchmark(
    model: torch.nn.Module,
    checkpoint_path: str,
    input_shape: tuple = (1, 28, 28),
    output_dir: str = "models/quantised",
    n_runs: int = 50,
) -> dict:
    import torch.quantization

    Path(output_dir).mkdir(parents=True, exist_ok=True)
    stem = Path(checkpoint_path).stem

    quantised_model = torch.quantization.quantize_dynamic(
        model, {torch.nn.Linear}, dtype=torch.qint8
    )
    quantised_model.eval()

    quantised_path = str(Path(output_dir) / f"{stem}_int8.pth")
    torch.save(quantised_model.state_dict(), quantised_path)
    file_size_mb = round(Path(quantised_path).stat().st_size / (1024 * 1024), 4)

    dummy = torch.randn(1, *input_shape)
    with torch.no_grad():
        for _ in range(10):
            _ = quantised_model(dummy)

    start = time.perf_counter()
    with torch.no_grad():
        for _ in range(n_runs):
            _ = quantised_model(dummy)
    elapsed = time.perf_counter() - start
    latency_ms = round((elapsed / n_runs) * 1000, 4)

    return {
        "file_size_mb": file_size_mb,
        "inference_latency_ms": latency_ms,
        "format": "PyTorch INT8 (dynamic quantised)",
        "path": quantised_path,
    }


def export_model(checkpoint_path: str, output_dir: str = "models/onnx", progress_callback=None) -> dict:
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    if progress_callback is not None:
        progress_callback(progress=5.0, message="Loading checkpoint from disk")
    checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
    model, _, input_shape = build_model_from_checkpoint(checkpoint)
    state_dict = checkpoint.get("model_state_dict", checkpoint)
    model.load_state_dict(state_dict)
    model.eval()

    stem = Path(checkpoint_path).stem
    onnx_path = str(Path(output_dir) / f"{stem}.onnx")

    dummy_input = torch.randn(1, *input_shape)
    if progress_callback is not None:
        progress_callback(progress=20.0, message="Exporting ONNX artifact")
    torch.onnx.export(
        model,
        dummy_input,
        onnx_path,
        export_params=True,
        opset_version=17,
        do_constant_folding=True,
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={"input": {0: "batch_size"}, "output": {0: "batch_size"}},
        dynamo=False,
    )

    pth_size_mb = round(Path(checkpoint_path).stat().st_size / (1024 * 1024), 4)
    onnx_size_mb = round(Path(onnx_path).stat().st_size / (1024 * 1024), 4)

    if progress_callback is not None:
        progress_callback(progress=45.0, message="Benchmarking PyTorch artifact")
    pth_latency_ms = benchmark_pytorch(model, input_shape=input_shape)
    if progress_callback is not None:
        progress_callback(progress=65.0, message="Benchmarking ONNX artifact")
    onnx_latency_ms = benchmark_onnx(onnx_path, input_shape=input_shape)

    size_reduction_pct = round((1 - onnx_size_mb / pth_size_mb) * 100, 2) if pth_size_mb > 0 else 0
    latency_speedup = round(pth_latency_ms / onnx_latency_ms, 2) if onnx_latency_ms > 0 else 0

    result = {
        "source_checkpoint": checkpoint_path,
        "onnx_path": onnx_path,
        "pytorch": {
            "file_size_mb": pth_size_mb,
            "inference_latency_ms": pth_latency_ms,
            "format": "PyTorch .pth",
        },
        "onnx": {
            "file_size_mb": onnx_size_mb,
            "inference_latency_ms": onnx_latency_ms,
            "format": "ONNX",
        },
        "comparison": {
            "size_reduction_pct": size_reduction_pct,
            "latency_speedup_x": latency_speedup,
        },
    }

    try:
        if progress_callback is not None:
            progress_callback(progress=82.0, message="Benchmarking INT8 quantised artifact")
        quant_result = quantise_and_benchmark(model, checkpoint_path, input_shape=input_shape, output_dir=output_dir)
        result["quantised"] = quant_result
        fp32_size = pth_size_mb
        int8_size = quant_result["file_size_mb"]
        result["comparison"]["int8_size_reduction_pct"] = (
            round((1 - int8_size / fp32_size) * 100, 2) if fp32_size > 0 else 0
        )
        result["comparison"]["int8_latency_speedup_x"] = (
            round(pth_latency_ms / quant_result["inference_latency_ms"], 2)
            if quant_result["inference_latency_ms"] > 0 else 0
        )
    except Exception as exc:
        result["quantised"] = None
        result["quantised_error"] = str(exc)

    report_path = f"results/onnx_export_{stem}.json"
    if progress_callback is not None:
        progress_callback(progress=94.0, message="Saving export report")
    Path(report_path).parent.mkdir(parents=True, exist_ok=True)
    with open(report_path, "w") as handle:
        json.dump(result, handle, indent=2)

    return result


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("checkpoint", help="Path to .pth file")
    arguments = parser.parse_args()
    export_model(arguments.checkpoint)
