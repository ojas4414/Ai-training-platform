from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class TrainRequest(BaseModel):
    learning_rate: float = Field(0.001, gt=0, description="Learning rate")
    batch_size: int = Field(64, ge=8, le=512, description="Batch size")
    epochs: int = Field(10, ge=1, le=100, description="Number of epochs")
    optimizer: str = Field("adam", pattern="^(adam|sgd)$", description="Optimizer (adam or sgd)")
    experiment_name: str = Field("ai-training-platform", description="MLflow experiment name")
    run_name: Optional[str] = Field(None, description="Optional MLflow run name")


class HPORequest(BaseModel):
    n_trials: int = Field(15, ge=3, le=50, description="Number of Optuna trials")
    n_jobs: int = Field(2, ge=1, le=4, description="Parallel Optuna workers")
    experiment_name: str = Field("ai-training-platform", description="MLflow experiment name")


class ExperimentResult(BaseModel):
    trial: Optional[int] = None
    learning_rate: float
    batch_size: int
    epochs: int
    optimizer: Optional[str] = "adam"
    best_accuracy: Optional[float] = None
    val_accuracy: Optional[float] = None


class HPOResult(BaseModel):
    best_trial: int
    best_val_accuracy: float
    best_params: Dict[str, Any]
    all_trials: List[Dict[str, Any]]
    n_jobs: Optional[int] = None
    execution_mode: Optional[str] = None


class ModelAnalysis(BaseModel):
    model_class: str
    input_shape: List[int]
    total_params: int
    trainable_params: int
    non_trainable_params: int
    inference_latency_ms: float
    file_size_mb: Optional[float]
    layers: List[Dict[str, Any]]
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
    top_predictions: List[PredictionScore]
    image_pixels: List[List[float]]


class TrainResponse(BaseModel):
    best_val_accuracy: float
    run_name: str
    checkpoint_path: str
    history: Dict[str, List[float]]


class HealthResponse(BaseModel):
    status: str
    mlflow_tracking_uri: str
    device: str
