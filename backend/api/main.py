"""
FastAPI application for the AI Training Platform backend.
Endpoints include health, training, HPO, experiment history, uploads,
model analysis, prediction, and ONNX export.
"""

import copy
import csv
import json
import os
import re
import sys
import time
import zipfile
from contextlib import asynccontextmanager
from functools import lru_cache
from pathlib import Path
from urllib.parse import unquote, urlparse

import mlflow
import torch
import uvicorn
from fastapi import FastAPI, File, HTTPException, Query, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.api.schemas import (
    DatasetListResponse,
    DatasetUploadResponse,
    HPORequest,
    HPOResult,
    HealthResponse,
    JobStatusResponse,
    MlflowRunsResponse,
    ModelAnalysis,
    ModelListResponse,
    ModelUploadResponse,
    PredictionRequest,
    PredictionResponse,
    TrainRequest,
    TrainResponse,
)
from backend.cache import config_cache_key, get_cache
from backend.jobs import JobContext, JobManager, JobNotFoundError
from backend.ml.assets import TABULAR_EXTENSIONS, load_training_asset
from backend.ml.model_factory import build_default_model, build_model_from_checkpoint


DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
MODELS_DIR = Path("models")
DATA_DIR = Path("data")
DATASET_UPLOADS_DIR = DATA_DIR / "uploads"
RESULTS_DIR = Path("results")
MODEL_EXTENSIONS = {".pt", ".pth"}
DATASET_EXTENSIONS = {".csv", ".tsv", ".json", ".zip"}
MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024
SAFE_FILENAME_RE = re.compile(r"[^A-Za-z0-9._-]+")


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
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    DATASET_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    tracking_path = resolve_local_tracking_path(get_tracking_uri())
    if tracking_path is not None:
        tracking_path.mkdir(parents=True, exist_ok=True)


def configure_mlflow() -> str:
    tracking_uri = get_tracking_uri()
    mlflow.set_tracking_uri(tracking_uri)
    return tracking_uri


def sanitize_upload_name(filename: str) -> str:
    base_name = Path(filename or "").name
    if not base_name:
        raise HTTPException(status_code=400, detail="Uploaded file must have a filename")

    stem = SAFE_FILENAME_RE.sub("-", Path(base_name).stem).strip(".-")
    suffix = Path(base_name).suffix.lower()
    if not stem:
        stem = "upload"
    return f"{stem}{suffix}"


def ensure_allowed_extension(filename: str, allowed_extensions: set[str], label: str) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix not in allowed_extensions:
        supported = ", ".join(sorted(allowed_extensions))
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported {label} file type '{suffix or 'unknown'}'. Allowed: {supported}",
        )
    return suffix


def build_unique_path(directory: Path, filename: str) -> Path:
    candidate = directory / filename
    stem = candidate.stem
    suffix = candidate.suffix
    counter = 1

    while candidate.exists():
        candidate = directory / f"{stem}-{counter}{suffix}"
        counter += 1

    return candidate


def resolve_named_file(directory: Path, filename: str, allowed_extensions: set[str], label: str) -> Path:
    base_name = Path(filename).name
    if not base_name or base_name != filename:
        raise HTTPException(status_code=400, detail=f"Invalid {label} filename")

    ensure_allowed_extension(base_name, allowed_extensions, label)

    target = (directory / base_name).resolve()
    if target.parent != directory.resolve():
        raise HTTPException(status_code=400, detail=f"Invalid {label} path")
    if not target.exists():
        raise HTTPException(status_code=404, detail=f"{label.capitalize()} '{base_name}' not found")

    return target


def model_file_payload(path: Path) -> dict[str, float | str]:
    return {
        "filename": path.name,
        "size_mb": round(path.stat().st_size / (1024 * 1024), 4),
        "modified": path.stat().st_mtime,
    }


def build_table_preview(path: Path, delimiter: str) -> dict:
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle, delimiter=delimiter)
        columns = reader.fieldnames or []
        sample_rows = []
        for index, row in enumerate(reader):
            if index >= 3:
                break
            sample_rows.append({key: value for key, value in row.items()})

    return {
        "kind": "table",
        "summary": f"Tabular dataset with {len(columns)} columns",
        "columns": columns,
        "sample_rows": sample_rows,
    }


def build_json_preview(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)

    if isinstance(payload, list):
        if payload and isinstance(payload[0], dict):
            columns = list(payload[0].keys())
            sample_rows = [
                {key: row.get(key) for key in columns[:8]}
                for row in payload[:3]
                if isinstance(row, dict)
            ]
            return {
                "kind": "json-records",
                "summary": f"JSON dataset with {len(payload)} top-level records",
                "columns": columns[:12],
                "sample_rows": sample_rows,
            }
        return {
            "kind": "json-list",
            "summary": f"JSON list with {len(payload)} items",
            "sample_rows": [{"value": item} for item in payload[:3]],
        }

    if isinstance(payload, dict):
        return {
            "kind": "json-object",
            "summary": f"JSON object with {len(payload)} top-level keys",
            "columns": list(payload.keys())[:12],
        }

    return {
        "kind": "json",
        "summary": "JSON dataset uploaded",
    }


def build_zip_preview(path: Path) -> dict:
    with zipfile.ZipFile(path) as archive:
        entries = [name for name in archive.namelist() if not name.endswith("/")]

    return {
        "kind": "archive",
        "summary": f"Archive with {len(entries)} files",
        "entries": entries[:8],
        "file_count": len(entries),
    }


def _path_signature(path: Path) -> tuple[str, int, int]:
    resolved = path.resolve()
    stats = resolved.stat()
    return str(resolved), stats.st_mtime_ns, stats.st_size


def build_dataset_preview_payload(path: Path) -> dict:
    suffix = path.suffix.lower()

    try:
        if suffix == ".csv":
            return build_table_preview(path, delimiter=",")
        if suffix == ".tsv":
            return build_table_preview(path, delimiter="\t")
        if suffix == ".json":
            return build_json_preview(path)
        if suffix == ".zip":
            return build_zip_preview(path)
    except Exception as exc:
        return {
            "kind": "unavailable",
            "summary": f"Preview unavailable: {exc}",
        }

    return {
        "kind": "file",
        "summary": f"{suffix[1:].upper()} dataset uploaded",
    }


@lru_cache(maxsize=128)
def _cached_dataset_preview(path_str: str, _mtime_ns: int, _size: int) -> dict:
    return build_dataset_preview_payload(Path(path_str))


def dataset_preview_payload(path: Path) -> dict:
    return copy.deepcopy(_cached_dataset_preview(*_path_signature(path)))


def dataset_file_payload(path: Path) -> dict:
    return {
        "filename": path.name,
        "extension": path.suffix.lower(),
        "size_mb": round(path.stat().st_size / (1024 * 1024), 4),
        "modified": path.stat().st_mtime,
        "preview": dataset_preview_payload(path),
    }


def list_uploaded_files(directory: Path, allowed_extensions: set[str]) -> list[Path]:
    files = [
        path
        for path in directory.iterdir()
        if path.is_file() and path.suffix.lower() in allowed_extensions
    ]
    files.sort(key=lambda item: item.stat().st_mtime, reverse=True)
    return files


def load_model_state_dict(checkpoint_path: Path) -> dict[str, torch.Tensor]:
    checkpoint = torch.load(checkpoint_path, map_location="cpu")
    if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
        return checkpoint["model_state_dict"]
    if isinstance(checkpoint, dict):
        return checkpoint
    raise HTTPException(status_code=400, detail="Unsupported checkpoint format")


@lru_cache(maxsize=2)
def _cached_mnist_dataset(split: str):
    from torchvision import datasets, transforms

    transform = transforms.Compose(
        [
            transforms.ToTensor(),
            transforms.Normalize((0.1307,), (0.3081,)),
        ]
    )

    return datasets.MNIST(
        root="./data",
        train=(split == "train"),
        download=True,
        transform=transform,
    )


def load_prediction_sample(split: str, sample_index: int) -> tuple[torch.Tensor, int, list[list[float]]]:
    dataset = _cached_mnist_dataset(split)

    if sample_index >= len(dataset):
        raise HTTPException(
            status_code=400,
            detail=f"Sample index {sample_index} is out of range for the {split} split",
        )

    image_tensor, label = dataset[sample_index]
    display_image = (image_tensor * 0.3081 + 0.1307).clamp(0, 1).squeeze(0)
    return image_tensor.unsqueeze(0), int(label), display_image.tolist()


@lru_cache(maxsize=16)
def _cached_prediction_bundle(path_str: str, _mtime_ns: int, _size: int):
    checkpoint = torch.load(path_str, map_location="cpu", weights_only=False)
    metadata = checkpoint.get("checkpoint_metadata") or {}
    model, _, _ = build_model_from_checkpoint(checkpoint)
    state_dict = checkpoint.get("model_state_dict", checkpoint)
    model.load_state_dict(state_dict)
    model.eval()
    return model, metadata


def load_prediction_bundle(checkpoint_path: Path):
    return _cached_prediction_bundle(*_path_signature(checkpoint_path))


def reset_runtime_caches() -> None:
    _cached_dataset_preview.cache_clear()
    _cached_mnist_dataset.cache_clear()
    _cached_prediction_bundle.cache_clear()


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_runtime_dirs()
    reset_runtime_caches()
    app.state.tracking_uri = configure_mlflow()
    app.state.jobs = JobManager(max_workers=int(os.getenv("JOB_MAX_WORKERS", "2")))
    try:
        yield
    finally:
        app.state.jobs.shutdown()


app = FastAPI(
    title="AI Training Platform API",
    description="AutoML experiment tracking and HPO platform built with PyTorch, Optuna, and MLflow.",
    version="1.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=get_cors_allow_credentials(),
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    return get_cache().stats()


def get_job_manager(request: Request) -> JobManager:
    return request.app.state.jobs


def validate_train_dataset_name(dataset_name: str | None) -> None:
    if not dataset_name or dataset_name == "mnist":
        return

    suffix = Path(dataset_name).suffix.lower()
    if suffix not in TABULAR_EXTENSIONS:
        supported = ", ".join(sorted(TABULAR_EXTENSIONS))
        raise HTTPException(
            status_code=400,
            detail=f"Only {supported} datasets are trainable right now",
        )

    resolve_named_file(DATASET_UPLOADS_DIR, Path(dataset_name).name, TABULAR_EXTENSIONS, "dataset")


def execute_train_request(request: TrainRequest, job_context: JobContext | None = None) -> dict:
    from backend.ml.train_engine import TrainEngine

    config = {
        "learning_rate": request.learning_rate,
        "batch_size": request.batch_size,
        "epochs": request.epochs,
        "optimizer": request.optimizer,
        "dataset_name": request.dataset_name or "mnist",
    }

    cache = get_cache()
    cache_key = config_cache_key(config)
    cached = cache.get(cache_key)
    if cached is not None:
        if job_context is not None:
            job_context.set_progress(100.0, "Training result served from cache")
        return cached

    validate_train_dataset_name(request.dataset_name)

    try:
        asset = load_training_asset(request.dataset_name)
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    model, checkpoint_metadata = build_default_model(asset)
    engine = TrainEngine(model, asset.dataset, config)

    run_name = request.run_name or f"api_run_{int(time.time())}"
    lr_tag = str(request.learning_rate).replace(".", "_")
    dataset_tag = asset.dataset_name.replace(".", "_")
    checkpoint_path = MODELS_DIR / f"{dataset_tag}_{lr_tag}_{int(time.time())}.pth"

    configure_mlflow()
    if job_context is not None:
        job_context.set_progress(5.0, f"Preparing training run for {asset.dataset_name}")

    def report_progress(**progress_payload):
        if job_context is None:
            return

        epoch = int(progress_payload["epoch"])
        total_epochs = int(progress_payload["total_epochs"])
        val_accuracy = float(progress_payload["val_accuracy"])
        progress = round((epoch / total_epochs) * 100, 1)
        job_context.set_progress(
            progress,
            f"Epoch {epoch}/{total_epochs} complete, best validation accuracy {val_accuracy:.2f}%",
        )

    best_val_accuracy, history = engine.train(
        experiment_name=request.experiment_name,
        run_name=run_name,
        checkpoint_path=str(checkpoint_path),
        checkpoint_metadata=checkpoint_metadata,
        progress_callback=report_progress,
    )

    result = {
        "best_val_accuracy": best_val_accuracy,
        "run_name": run_name,
        "checkpoint_path": str(checkpoint_path),
        "history": history,
        "dataset_name": asset.dataset_name,
        "dataset_kind": asset.dataset_kind,
    }

    cache.set(cache_key, result, ttl=3600)
    return result


def execute_hpo_request(request: HPORequest, job_context: JobContext | None = None) -> dict:
    sys.path.insert(0, str(Path(__file__).parent.parent.parent))
    from scripts.hpo_search import run_hpo as run_hpo_internal

    validate_train_dataset_name(request.dataset_name)
    configure_mlflow()
    try:
        return run_hpo_internal(
            n_trials=request.n_trials,
            n_jobs=request.n_jobs,
            experiment_name=request.experiment_name,
            dataset_name=request.dataset_name,
            progress_callback=(
                lambda **payload: job_context.set_progress(
                    round((payload["completed_trials"] / payload["total_trials"]) * 100, 1),
                    (
                        f"Completed {payload['completed_trials']}/{payload['total_trials']} HPO trials"
                        + (
                            f", current best {payload['best_value']:.2f}%"
                            if payload.get("best_value") is not None
                            else ""
                        )
                    ),
                )
                if job_context is not None
                else None
            ),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def execute_analysis_request(checkpoint_filename: str, job_context: JobContext | None = None) -> dict:
    checkpoint_path = resolve_named_file(MODELS_DIR, checkpoint_filename, MODEL_EXTENSIONS, "model")

    from scripts.analyse_model import analyse_from_checkpoint

    output_json = RESULTS_DIR / f"analysis_{checkpoint_path.stem}.json"
    return analyse_from_checkpoint(
        str(checkpoint_path),
        output_json=str(output_json),
        progress_callback=(
            lambda **payload: job_context.set_progress(payload.get("progress"), payload["message"])
            if job_context is not None
            else None
        ),
    )


def execute_export_request(checkpoint_filename: str, job_context: JobContext | None = None) -> dict:
    from scripts.export_onnx import export_model

    checkpoint_path = resolve_named_file(MODELS_DIR, checkpoint_filename, MODEL_EXTENSIONS, "model")
    return export_model(
        str(checkpoint_path),
        progress_callback=(
            lambda **payload: job_context.set_progress(payload.get("progress"), payload["message"])
            if job_context is not None
            else None
        ),
    )


@app.post("/train", response_model=TrainResponse, tags=["training"])
def train(request: TrainRequest):
    return execute_train_request(request)


@app.post("/hpo", response_model=HPOResult, tags=["training"])
def run_hpo(request: HPORequest):
    return execute_hpo_request(request)


@app.post(
    "/train/jobs",
    response_model=JobStatusResponse,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["training"],
)
def create_train_job(payload: TrainRequest, request: Request):
    validate_train_dataset_name(payload.dataset_name)
    manager = get_job_manager(request)
    return manager.enqueue(
        "train",
        lambda context: execute_train_request(payload, job_context=context),
        queued_message="Training job queued",
        running_message="Training job running",
    )


@app.post(
    "/hpo/jobs",
    response_model=JobStatusResponse,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["training"],
)
def create_hpo_job(payload: HPORequest, request: Request):
    validate_train_dataset_name(payload.dataset_name)
    manager = get_job_manager(request)
    return manager.enqueue(
        "hpo",
        lambda context: execute_hpo_request(payload, job_context=context),
        queued_message="HPO job queued",
        running_message="HPO job running",
    )


@app.get("/jobs/{job_id}", response_model=JobStatusResponse, tags=["meta"])
def get_job_status(job_id: str, request: Request):
    manager = get_job_manager(request)
    try:
        return manager.get(job_id)
    except JobNotFoundError as exc:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found") from exc


@app.get("/experiments", tags=["experiments"])
def get_experiments():
    results_file = RESULTS_DIR / "results.json"
    hpo_file = RESULTS_DIR / "best_hpo_config.json"

    results: dict[str, object] = {}

    if results_file.exists():
        with results_file.open() as handle:
            results["manual_experiments"] = json.load(handle)
    else:
        results["manual_experiments"] = []

    if hpo_file.exists():
        with hpo_file.open() as handle:
            results["hpo_results"] = json.load(handle)
    else:
        results["hpo_results"] = None

    return results


@app.get("/experiments/mlflow", response_model=MlflowRunsResponse, tags=["experiments"])
def get_mlflow_runs(
    limit: int = Query(12, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    configure_mlflow()
    try:
        client = mlflow.tracking.MlflowClient()
        experiments = client.search_experiments()
        all_runs = []
        requested_window = min(max(limit + offset, 50), 200)
        for experiment in experiments:
            runs = client.search_runs(
                experiment_ids=[experiment.experiment_id],
                order_by=["metrics.best_val_accuracy DESC"],
                max_results=requested_window,
            )
            for run in runs:
                all_runs.append(
                    {
                        "run_id": run.info.run_id,
                        "run_name": run.info.run_name,
                        "experiment": experiment.name,
                        "status": run.info.status,
                        "start_time": run.info.start_time,
                        "params": run.data.params,
                        "metrics": run.data.metrics,
                    }
                )
        all_runs.sort(key=lambda item: item.get("start_time") or 0, reverse=True)
        page = all_runs[offset: offset + limit]
        return {
            "runs": page,
            "total": len(all_runs),
            "limit": limit,
            "offset": offset,
            "has_more": offset + limit < len(all_runs),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/models", response_model=ModelListResponse, tags=["model"])
def list_models():
    if not MODELS_DIR.exists():
        return {"models": []}

    models = [model_file_payload(path) for path in list_uploaded_files(MODELS_DIR, MODEL_EXTENSIONS)]
    return {"models": models}


@app.post(
    "/models/upload",
    response_model=ModelUploadResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["model"],
)
async def upload_model(file: UploadFile = File(...)):
    safe_name = sanitize_upload_name(file.filename or "")
    ensure_allowed_extension(safe_name, MODEL_EXTENSIONS, "model")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded model file is empty")
    if len(content) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Uploaded model file is too large")

    target = build_unique_path(MODELS_DIR, safe_name)
    target.write_bytes(content)

    return {
        "message": "Model uploaded successfully",
        "model": model_file_payload(target),
    }


@app.get("/datasets", response_model=DatasetListResponse, tags=["data"])
def list_datasets():
    if not DATASET_UPLOADS_DIR.exists():
        return {"datasets": []}

    datasets = [
        dataset_file_payload(path)
        for path in list_uploaded_files(DATASET_UPLOADS_DIR, DATASET_EXTENSIONS)
    ]
    return {"datasets": datasets}


@app.post(
    "/datasets/upload",
    response_model=DatasetUploadResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["data"],
)
async def upload_dataset(file: UploadFile = File(...)):
    safe_name = sanitize_upload_name(file.filename or "")
    ensure_allowed_extension(safe_name, DATASET_EXTENSIONS, "dataset")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded dataset file is empty")
    if len(content) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Uploaded dataset file is too large")

    target = build_unique_path(DATASET_UPLOADS_DIR, safe_name)
    target.write_bytes(content)

    return {
        "message": "Dataset uploaded successfully",
        "dataset": dataset_file_payload(target),
    }


@app.post(
    "/analyse/{checkpoint_filename}/jobs",
    response_model=JobStatusResponse,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["model"],
)
def create_analysis_job(checkpoint_filename: str, request: Request):
    resolve_named_file(MODELS_DIR, checkpoint_filename, MODEL_EXTENSIONS, "model")
    manager = get_job_manager(request)
    return manager.enqueue(
        "analyse",
        lambda context: execute_analysis_request(checkpoint_filename, job_context=context),
        queued_message="Analysis job queued",
        running_message="Analysis job running",
    )


@app.get("/analyse/{checkpoint_filename}", response_model=ModelAnalysis, tags=["model"])
def analyse_model(checkpoint_filename: str):
    return execute_analysis_request(checkpoint_filename)


@app.post("/predict/{checkpoint_filename}", response_model=PredictionResponse, tags=["model"])
def predict_model(checkpoint_filename: str, request: PredictionRequest):
    checkpoint_path = resolve_named_file(MODELS_DIR, checkpoint_filename, MODEL_EXTENSIONS, "model")
    try:
        model, metadata = load_prediction_bundle(checkpoint_path)
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"Checkpoint load failed: {exc}") from exc
    if metadata.get("dataset_kind") not in {None, "mnist"}:
        raise HTTPException(
            status_code=400,
            detail="Sample-index prediction is only supported for MNIST-compatible checkpoints right now",
        )

    image_batch, true_label, image_pixels = load_prediction_sample(
        split=request.split,
        sample_index=request.sample_index,
    )

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
        "checkpoint_filename": checkpoint_path.name,
        "sample_index": request.sample_index,
        "split": request.split,
        "predicted_label": predicted_label,
        "true_label": true_label,
        "confidence": confidence,
        "matches_label": predicted_label == true_label,
        "top_predictions": top_predictions,
        "image_pixels": image_pixels,
    }


@app.post(
    "/export/{checkpoint_filename}/jobs",
    response_model=JobStatusResponse,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["model"],
)
def create_export_job(checkpoint_filename: str, request: Request):
    resolve_named_file(MODELS_DIR, checkpoint_filename, MODEL_EXTENSIONS, "model")
    manager = get_job_manager(request)
    return manager.enqueue(
        "export",
        lambda context: execute_export_request(checkpoint_filename, job_context=context),
        queued_message="Export job queued",
        running_message="Export job running",
    )


@app.post("/export/{checkpoint_filename}", tags=["model"])
def export_onnx(checkpoint_filename: str):
    return execute_export_request(checkpoint_filename)


if __name__ == "__main__":
    host = os.getenv("APP_HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    reload = os.getenv("RELOAD", "true").strip().lower() in {"1", "true", "yes", "on"}
    uvicorn.run("backend.api.main:app", host=host, port=port, reload=reload)
