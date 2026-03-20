from typing import Any

from pydantic import BaseModel, Field


class TrainRequest(BaseModel):
    learning_rate: float = Field(0.001, gt=0, description="Learning rate")
    batch_size: int = Field(64, ge=8, le=512, description="Batch size")
    epochs: int = Field(10, ge=1, le=100, description="Number of epochs")
    optimizer: str = Field("adam", pattern="^(adam|sgd)$", description="Optimizer (adam or sgd)")
    experiment_name: str = Field("ai-training-platform", description="MLflow experiment name")
    run_name: str | None = Field(None, description="Optional MLflow run name")
    dataset_name: str | None = Field(None, description="Uploaded dataset filename, or omit for built-in MNIST")


class HPORequest(BaseModel):
    n_trials: int = Field(15, ge=3, le=50, description="Number of Optuna trials")
    n_jobs: int = Field(2, ge=1, le=4, description="Parallel Optuna workers")
    experiment_name: str = Field("ai-training-platform", description="MLflow experiment name")
    dataset_name: str | None = Field(None, description="Uploaded dataset filename, or omit for built-in MNIST")


class ExperimentResult(BaseModel):
    trial: int | None = None
    learning_rate: float
    batch_size: int
    epochs: int
    optimizer: str | None = "adam"
    best_accuracy: float | None = None
    val_accuracy: float | None = None


class HPOResult(BaseModel):
    best_trial: int
    best_val_accuracy: float
    best_params: dict[str, Any]
    all_trials: list[dict[str, Any]]
    n_jobs: int | None = None
    execution_mode: str | None = None
    dataset_name: str | None = None
    dataset_kind: str | None = None


class MlflowRun(BaseModel):
    run_id: str
    run_name: str | None = None
    experiment: str
    status: str
    start_time: int | None = None
    params: dict[str, str]
    metrics: dict[str, float]


class MlflowRunsResponse(BaseModel):
    runs: list[MlflowRun]
    total: int
    limit: int
    offset: int
    has_more: bool


class ModelAnalysis(BaseModel):
    model_class: str
    input_shape: list[int]
    total_params: int
    trainable_params: int
    non_trainable_params: int
    inference_latency_ms: float
    file_size_mb: float | None
    layers: list[dict[str, Any]]
    torchsummary: str


class PredictionRequest(BaseModel):
    sample_index: int = Field(0, ge=0, description="MNIST sample index to run inference on")
    split: str = Field("test", pattern="^(train|test)$", description="Dataset split to sample from")
    top_k: int = Field(3, ge=1, le=10, description="How many class probabilities to return")


class PredictionScore(BaseModel):
    label: int
    confidence: float


class PredictionResponse(BaseModel):
    checkpoint_filename: str
    sample_index: int
    split: str
    predicted_label: int
    true_label: int
    confidence: float
    matches_label: bool
    top_predictions: list[PredictionScore]
    image_pixels: list[list[float]]


class TrainResponse(BaseModel):
    best_val_accuracy: float
    run_name: str
    checkpoint_path: str
    history: dict[str, list[float]]
    dataset_name: str | None = None
    dataset_kind: str | None = None


class JobStatusResponse(BaseModel):
    job_id: str
    kind: str
    status: str
    message: str
    progress: float | None = None
    created_at: float
    updated_at: float
    started_at: float | None = None
    completed_at: float | None = None
    error: str | None = None
    result: dict[str, Any] | None = None


class HealthResponse(BaseModel):
    status: str
    mlflow_tracking_uri: str
    device: str


class ModelFile(BaseModel):
    filename: str
    size_mb: float
    modified: float


class ModelListResponse(BaseModel):
    models: list[ModelFile]


class DatasetPreview(BaseModel):
    kind: str
    summary: str
    columns: list[str] | None = None
    sample_rows: list[dict[str, Any]] | None = None
    entries: list[str] | None = None
    file_count: int | None = None


class DatasetFile(BaseModel):
    filename: str
    extension: str
    size_mb: float
    modified: float
    preview: DatasetPreview | None = None


class DatasetListResponse(BaseModel):
    datasets: list[DatasetFile]


class ModelUploadResponse(BaseModel):
    message: str
    model: ModelFile


class DatasetUploadResponse(BaseModel):
    message: str
    dataset: DatasetFile
