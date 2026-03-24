"""
FastAPI application - AI Training Platform backend.
Endpoints: /health, /train, /hpo, /experiments, /analyse, /export
"""
import base64
import io
import json
import os
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import unquote, urlparse

import numpy as np
import mlflow
import torch
import uvicorn
import asyncio
import psutil
from PIL import Image
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

try:
    import pynvml
    pynvml.nvmlInit()
    HAS_NVML = True
except Exception:
    HAS_NVML = False

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.api.schemas import (
    HealthResponse,
    HPORequest,
    HPOResult,
    ModelAnalysis,
    PredictionRequest,
    PredictionResponse,
    TrainRequest,
    TrainResponse,
)
from backend.cache import config_cache_key, get_cache


# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
]


def get_tracking_uri() -> str:
    return os.getenv("MLFLOW_TRACKING_URI", "mlruns")


def get_cors_origins() -> list[str]:
    raw_origins = os.getenv("CORS_ALLOW_ORIGINS")
    if not raw_origins:
        return DEFAULT_CORS_ORIGINS
    return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]


def get_cors_allow_credentials() -> bool:
    return os.getenv("CORS_ALLOW_CREDENTIALS", "false").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def resolve_local_tracking_path(tracking_uri: str) -> Path | None:
    parsed = urlparse(tracking_uri)
    if parsed.scheme not in {"", "file"}:
        return None

    if parsed.scheme == "file":
        raw_path = unquote(parsed.path)
        if os.name == "nt" and raw_path.startswith("/") and len(raw_path) > 2 and raw_path[2] == ":":
            raw_path = raw_path.lstrip("/")
        return Path(raw_path)

    return Path(tracking_uri)


def ensure_runtime_dirs() -> None:
    Path("data").mkdir(parents=True, exist_ok=True)
    Path("models").mkdir(parents=True, exist_ok=True)
    Path("results").mkdir(parents=True, exist_ok=True)

    tracking_path = resolve_local_tracking_path(get_tracking_uri())
    if tracking_path is not None:
        tracking_path.mkdir(parents=True, exist_ok=True)


def configure_mlflow() -> str:
    tracking_uri = get_tracking_uri()
    mlflow.set_tracking_uri(tracking_uri)
    return tracking_uri


def load_model_state_dict(checkpoint_path: Path) -> dict[str, torch.Tensor]:
    checkpoint = torch.load(checkpoint_path, map_location="cpu")
    if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
        return checkpoint["model_state_dict"]
    if isinstance(checkpoint, dict):
        return checkpoint
    raise HTTPException(status_code=400, detail="Unsupported checkpoint format")


def load_prediction_sample(split: str, sample_index: int) -> tuple[torch.Tensor, int, list[list[float]]]:
    from torchvision import datasets, transforms

    transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize((0.1307,), (0.3081,)),
    ])

    dataset = datasets.MNIST(
        root="./data",
        train=(split == "train"),
        download=True,
        transform=transform,
    )

    if sample_index >= len(dataset):
        raise HTTPException(
            status_code=400,
            detail=f"Sample index {sample_index} is out of range for the {split} split",
        )

    image_tensor, label = dataset[sample_index]
    display_image = (image_tensor * 0.3081 + 0.1307).clamp(0, 1).squeeze(0)
    return image_tensor.unsqueeze(0), int(label), display_image.tolist()


def process_uploaded_image(base64_str: str) -> tuple[torch.Tensor, list[list[float]]]:
    """
    Process a base64 encoded image for MNIST inference.
    Includes auto-inversion for light backgrounds.
    """
    try:
        # Remove header if present (e.g. "data:image/png;base64,")
        if "," in base64_str:
            base64_str = base64_str.split(",")[1]
            
        img_bytes = base64.b64decode(base64_str)
        img = Image.open(io.BytesIO(img_bytes)).convert('L')  # grayscale
        img = img.resize((28, 28), Image.LANCZOS)
        
        img_array = np.array(img, dtype=np.float32) / 255.0
        
        # Auto-invert if background is light (MNIST expects white digit on black)
        # We check the mean of the pixels.
        if img_array.mean() > 0.5:
            img_array = 1.0 - img_array
            
        # Display image before normalization (for frontend preview)
        display_pixels = img_array.tolist()
        
        # Apply MNIST normalization
        img_array = (img_array - 0.1307) / 0.3081
        
        # Convert to tensor with shape [1, 1, 28, 28]
        tensor = torch.from_numpy(img_array).unsqueeze(0).unsqueeze(0)
        return tensor, display_pixels
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image processing failed: {str(e)}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_runtime_dirs()
    app.state.tracking_uri = configure_mlflow()
    yield


app = FastAPI(
    title="AI Training Platform API",
    description="AutoML experiment tracking and HPO platform. Built with PyTorch + Optuna + MLflow.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=get_cors_allow_credentials(),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse, tags=["meta"])
def health_check():
    tracking_uri = configure_mlflow()
    device = "cuda" if torch.cuda.is_available() else "cpu"
    return {
        "status": "ok",
        "mlflow_tracking_uri": tracking_uri,
        "device": device,
    }


@app.get("/cache/stats", tags=["meta"])
def cache_stats():
    """Return cache hit/miss statistics."""
    return get_cache().stats()


# ---------------------------------------------------------------------------
# Telemetry Stream
# ---------------------------------------------------------------------------

@app.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    """
    Emit server GPU and CPU telemetry at exactly 2Hz (500ms intervals).
    """
    await websocket.accept()
    psutil.cpu_percent(interval=None)
    
    try:
        while True:
            cpu = psutil.cpu_percent(interval=None)
            
            try:
                if not HAS_NVML:
                    raise Exception("No NVML")
                gpu_count = pynvml.nvmlDeviceGetCount()
                gpus = []
                for i in range(gpu_count):
                    handle = pynvml.nvmlDeviceGetHandleByIndex(i)
                    gpus.append({
                        "index": i,
                        "load": pynvml.nvmlDeviceGetUtilizationRates(handle).gpu,
                        "temp": pynvml.nvmlDeviceGetTemperature(
                            handle, pynvml.NVML_TEMPERATURE_GPU
                        ),
                        "vram": pynvml.nvmlDeviceGetMemoryInfo(handle).used /
                                max(pynvml.nvmlDeviceGetMemoryInfo(handle).total, 1) * 100
                    })
            except Exception:
                gpus = [
                    {"index": i, "load": cpu, "temp": 45, "vram": 30}
                    for i in range(8)
                ]
            
            payload = {
                "cpu_percent": cpu,
                "gpus": gpus,
                "timestamp": time.time()
            }
            
            await websocket.send_json(payload)
            await asyncio.sleep(0.5)
            
    except WebSocketDisconnect:
        pass


# ---------------------------------------------------------------------------
# Train
# ---------------------------------------------------------------------------

@app.post("/train", response_model=TrainResponse, tags=["training"])
def train(request: TrainRequest):
    """
    Launch a single training run with given hyperparameters.
    Logs to MLflow and saves best checkpoint.
    Returns cached result when the same config has already been trained.
    """
    from torchvision import datasets, transforms

    from backend.ml.train_engine import TrainEngine
    from backend.ml.train_mnist import SimpleNN

    config = {
        "learning_rate": request.learning_rate,
        "batch_size": request.batch_size,
        "epochs": request.epochs,
        "optimizer": request.optimizer,
    }

    # --- Cache check ---
    cache = get_cache()
    cache_key = config_cache_key(config)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize((0.1307,), (0.3081,)),
    ])
    dataset = datasets.MNIST(root="./data", train=True, download=True, transform=transform)

    model = SimpleNN()
    engine = TrainEngine(model, dataset, config)

    run_name = request.run_name or f"api_run_{int(time.time())}"
    lr_tag = str(request.learning_rate).replace(".", "_")
    checkpoint_path = f"models/api_{lr_tag}_{int(time.time())}.pth"

    configure_mlflow()
    best_val_accuracy, history = engine.train(
        experiment_name=request.experiment_name,
        run_name=run_name,
        checkpoint_path=checkpoint_path,
    )

    result = {
        "best_val_accuracy": best_val_accuracy,
        "run_name": run_name,
        "checkpoint_path": checkpoint_path,
        "history": history,
    }

    # --- Cache store (1 hour TTL) ---
    cache.set(cache_key, result, ttl=3600)

    return result


# ---------------------------------------------------------------------------
# HPO
# ---------------------------------------------------------------------------

@app.post("/hpo", response_model=HPOResult, tags=["training"])
def run_hpo(request: HPORequest):
    """
    Launch an Optuna hyperparameter search.
    All trials are logged to MLflow automatically.
    """
    sys.path.insert(0, str(Path(__file__).parent.parent.parent))
    from scripts.hpo_search import run_hpo as _run_hpo

    configure_mlflow()
    result = _run_hpo(
        n_trials=request.n_trials,
        n_jobs=request.n_jobs,
        experiment_name=request.experiment_name,
    )
    return result


# ---------------------------------------------------------------------------
# Experiments
# ---------------------------------------------------------------------------

@app.get("/experiments", tags=["experiments"])
def get_experiments():
    """Return all recorded experiment results."""
    results_file = Path("results/results.json")
    hpo_file = Path("results/best_hpo_config.json")

    results = {}

    if results_file.exists():
        with open(results_file) as f:
            results["manual_experiments"] = json.load(f)
    else:
        results["manual_experiments"] = []

    if hpo_file.exists():
        with open(hpo_file) as f:
            results["hpo_results"] = json.load(f)
    else:
        results["hpo_results"] = None

    return results


@app.get("/experiments/mlflow", tags=["experiments"])
def get_mlflow_runs():
    """Return MLflow runs for the default experiment."""
    configure_mlflow()
    try:
        client = mlflow.tracking.MlflowClient()
        experiments = client.search_experiments()
        all_runs = []
        for exp in experiments:
            runs = client.search_runs(
                experiment_ids=[exp.experiment_id],
                order_by=["metrics.best_val_accuracy DESC"],
                max_results=50,
            )
            for run in runs:
                all_runs.append({
                    "run_id": run.info.run_id,
                    "run_name": run.info.run_name,
                    "experiment": exp.name,
                    "status": run.info.status,
                    "start_time": run.info.start_time,
                    "params": run.data.params,
                    "metrics": run.data.metrics,
                })
        return {"runs": all_runs, "total": len(all_runs)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Model Analysis
# ---------------------------------------------------------------------------

@app.get("/analyse/{checkpoint_filename}", response_model=ModelAnalysis, tags=["model"])
def analyse_model(checkpoint_filename: str):
    """Analyse a saved model checkpoint. Returns layer info, param count, latency."""
    checkpoint_path = Path("models") / checkpoint_filename
    if not checkpoint_path.exists():
        raise HTTPException(status_code=404, detail=f"Checkpoint '{checkpoint_filename}' not found")

    from scripts.analyse_model import analyse_from_checkpoint
    from backend.ml.train_mnist import SimpleNN

    output_json = f"results/analysis_{checkpoint_filename.replace('.pth', '')}.json"
    analysis = analyse_from_checkpoint(
        str(checkpoint_path),
        SimpleNN,
        input_shape=(1, 28, 28),
        output_json=output_json,
    )
    return analysis


@app.get("/models", tags=["model"])
def list_models():
    """List all saved model checkpoints."""
    models_dir = Path("models")
    if not models_dir.exists():
        return {"models": []}

    models = []
    for checkpoint in models_dir.glob("*.pth"):
        models.append({
            "filename": checkpoint.name,
            "size_mb": round(checkpoint.stat().st_size / (1024 * 1024), 4),
            "modified": checkpoint.stat().st_mtime,
        })
    models.sort(key=lambda item: item["modified"], reverse=True)
    return {"models": models}


# ---------------------------------------------------------------------------
# Prediction
# ---------------------------------------------------------------------------

@app.post("/predict/{checkpoint_filename}", response_model=PredictionResponse, tags=["model"])
def predict_model(checkpoint_filename: str, request: PredictionRequest):
    """Run inference on a single sample (dataset or upload) using a saved checkpoint."""
    checkpoint_path = Path("models") / checkpoint_filename
    if not checkpoint_path.exists():
        raise HTTPException(status_code=404, detail=f"Checkpoint '{checkpoint_filename}' not found")

    from backend.ml.train_mnist import SimpleNN

    if request.image_base64:
        image_batch, image_pixels = process_uploaded_image(request.image_base64)
        true_label = -1
        sample_index = None
        split = None
    else:
        if request.sample_index is None:
             raise HTTPException(status_code=400, detail="Either 'sample_index' or 'image_base64' must be provided")
        
        image_batch, true_label, image_pixels = load_prediction_sample(
            split=request.split or "test",
            sample_index=request.sample_index,
        )
        sample_index = request.sample_index
        split = request.split or "test"

    model = SimpleNN()
    try:
        model.load_state_dict(load_model_state_dict(checkpoint_path))
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=f"Checkpoint load failed: {exc}") from exc
    model.eval()

    with torch.inference_mode():
        logits = model(image_batch)
        probabilities = torch.softmax(logits, dim=1)[0]

    top_k = min(request.top_k, probabilities.numel())
    top_probs, top_labels = torch.topk(probabilities, k=top_k)
    predicted_label = int(top_labels[0].item())
    confidence = float(top_probs[0].item())
    top_predictions = [
        {
            "label": int(label.item()),
            "confidence": float(prob.item()),
        }
        for prob, label in zip(top_probs, top_labels)
    ]

    return {
        "checkpoint_filename": checkpoint_filename,
        "sample_index": sample_index,
        "split": split,
        "predicted_label": predicted_label,
        "true_label": true_label,
        "confidence": confidence,
        "matches_label": predicted_label == true_label if true_label != -1 else True,
        "top_predictions": top_predictions,
        "image_pixels": image_pixels,
    }


# ---------------------------------------------------------------------------
# ONNX Export
# ---------------------------------------------------------------------------

@app.post("/export/{checkpoint_filename}", tags=["model"])
def export_onnx(checkpoint_filename: str):
    """Export a .pth model to ONNX format and benchmark latency."""
    from scripts.export_onnx import export_model

    checkpoint_path = Path("models") / checkpoint_filename
    if not checkpoint_path.exists():
        raise HTTPException(status_code=404, detail=f"Checkpoint '{checkpoint_filename}' not found")

    result = export_model(str(checkpoint_path))
    return result


# ---------------------------------------------------------------------------
# Dev server entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    host = os.getenv("APP_HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    reload = os.getenv("RELOAD", "true").strip().lower() in {"1", "true", "yes", "on"}
    uvicorn.run("backend.api.main:app", host=host, port=port, reload=reload)
