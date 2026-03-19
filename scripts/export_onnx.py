"""
export_onnx.py — Export a trained PyTorch model to ONNX format.
Benchmarks size and inference latency for .pth, .onnx, and INT8-quantised.
"""
import json
import time
import sys
from pathlib import Path

import torch
import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent))


def benchmark_onnx(onnx_path: str, input_shape=(1, 1, 28, 28), n_runs: int = 200) -> float:
    try:
        import onnxruntime as ort
        sess = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
        dummy = np.random.randn(*input_shape).astype(np.float32)
        input_name = sess.get_inputs()[0].name

        # Warm up
        for _ in range(10):
            sess.run(None, {input_name: dummy})

        start = time.perf_counter()
        for _ in range(n_runs):
            sess.run(None, {input_name: dummy})
        elapsed = time.perf_counter() - start
        return round((elapsed / n_runs) * 1000, 4)
    except Exception as e:
        return -1.0


def benchmark_pytorch(model: torch.nn.Module, input_shape=(1, 1, 28, 28), n_runs: int = 200) -> float:
    model.eval()
    dummy = torch.randn(*input_shape)

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
    input_shape: tuple = (1, 1, 28, 28),
    output_dir: str = "models/quantised",
    n_runs: int = 200,
) -> dict:
    """
    Apply INT8 dynamic quantisation, save the quantised model,
    and benchmark inference latency.
    """
    import torch.quantization

    Path(output_dir).mkdir(parents=True, exist_ok=True)
    stem = Path(checkpoint_path).stem

    quantised_model = torch.quantization.quantize_dynamic(
        model, {torch.nn.Linear}, dtype=torch.qint8
    )
    quantised_model.eval()

    # Save quantised state
    quantised_path = str(Path(output_dir) / f"{stem}_int8.pth")
    torch.save(quantised_model.state_dict(), quantised_path)
    file_size_mb = round(Path(quantised_path).stat().st_size / (1024 * 1024), 4)

    # Benchmark
    dummy = torch.randn(*input_shape)
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


def export_model(checkpoint_path: str, output_dir: str = "models/onnx") -> dict:
    """
    Load a .pth checkpoint, export to ONNX, and return comparison metrics.
    """
    from backend.ml.train_mnist import SimpleNN

    Path(output_dir).mkdir(parents=True, exist_ok=True)

    # Load model
    checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
    model = SimpleNN()
    state_dict = checkpoint.get("model_state_dict", checkpoint)
    model.load_state_dict(state_dict)
    model.eval()

    # ONNX export path
    stem = Path(checkpoint_path).stem
    onnx_path = str(Path(output_dir) / f"{stem}.onnx")

    # Export
    dummy_input = torch.randn(1, 1, 28, 28)
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
    )

    # Size comparison
    pth_size_mb = round(Path(checkpoint_path).stat().st_size / (1024 * 1024), 4)
    onnx_size_mb = round(Path(onnx_path).stat().st_size / (1024 * 1024), 4)

    # Latency comparison
    pth_latency_ms = benchmark_pytorch(model)
    onnx_latency_ms = benchmark_onnx(onnx_path)

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

    # --- INT8 dynamic quantisation ---
    try:
        quant_result = quantise_and_benchmark(model, checkpoint_path, output_dir=output_dir)
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

    # Save report
    report_path = f"results/onnx_export_{stem}.json"
    with open(report_path, "w") as f:
        json.dump(result, f, indent=2)

    print(f"\n{'='*55}")
    print(f"EXPORT COMPLETE")
    print(f"  FP32 (.pth):    {pth_size_mb} MB | {pth_latency_ms} ms")
    print(f"  ONNX (.onnx):   {onnx_size_mb} MB | {onnx_latency_ms} ms")
    if result.get("quantised"):
        q = result["quantised"]
        print(f"  INT8 (quant):   {q['file_size_mb']} MB | {q['inference_latency_ms']} ms")
    print(f"  ONNX size reduction:  {size_reduction_pct}%")
    print(f"  ONNX latency speedup: {latency_speedup}x")
    print(f"{'='*55}")

    return result


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("checkpoint", help="Path to .pth file")
    args = parser.parse_args()
    export_model(args.checkpoint)
