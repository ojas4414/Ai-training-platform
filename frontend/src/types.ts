export interface ManualExperiment {
  learning_rate: number;
  batch_size: number;
  epochs: number;
  best_accuracy: number;
}

export interface HpoTrial {
  trial: number;
  val_accuracy: number;
  learning_rate: number;
  batch_size: number;
  epochs: number;
  optimizer: string;
  hidden_size: number;
  n_layers: number;
  dropout: number;
}

export interface HpoResult {
  best_trial: number;
  best_val_accuracy: number;
  best_params: Record<string, number | string>;
  all_trials: HpoTrial[];
  n_jobs?: number;
  execution_mode?: 'parallel' | 'sequential';
  dataset_name?: string;
  dataset_kind?: string;
}

export interface ExperimentsResponse {
  manual_experiments: ManualExperiment[];
  hpo_results: HpoResult | null;
}

export interface MlflowRun {
  run_id: string;
  run_name: string | null;
  experiment: string;
  status: string;
  start_time: number | null;
  params: Record<string, string>;
  metrics: Record<string, number>;
}

export interface MlflowRunsResponse {
  runs: MlflowRun[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export type JobKind = 'train' | 'hpo' | 'analyse' | 'export';

export type JobState = 'queued' | 'running' | 'completed' | 'failed';

export interface JobStatus<T = Record<string, unknown>> {
  job_id: string;
  kind: JobKind;
  status: JobState;
  message: string;
  progress?: number | null;
  created_at: number;
  updated_at: number;
  started_at?: number | null;
  completed_at?: number | null;
  error?: string | null;
  result?: T | null;
}

export interface HealthResponse {
  status: string;
  mlflow_tracking_uri: string;
  device: string;
}

export interface ModelFile {
  filename: string;
  size_mb: number;
  modified: number;
}

export interface DatasetPreview {
  kind: string;
  summary: string;
  columns?: string[] | null;
  sample_rows?: Array<Record<string, unknown>> | null;
  entries?: string[] | null;
  file_count?: number | null;
}

export interface DatasetFile {
  filename: string;
  extension: string;
  size_mb: number;
  modified: number;
  preview?: DatasetPreview | null;
}

export interface ModelUploadResponse {
  message: string;
  model: ModelFile;
}

export interface DatasetUploadResponse {
  message: string;
  dataset: DatasetFile;
}

export interface OnnxComparison {
  source_checkpoint: string;
  onnx_path: string;
  pytorch: { file_size_mb: number; inference_latency_ms: number; format: string };
  onnx: { file_size_mb: number; inference_latency_ms: number; format: string };
  quantised?: { file_size_mb: number; inference_latency_ms: number; format: string; path: string } | null;
  comparison: {
    size_reduction_pct: number;
    latency_speedup_x: number;
    int8_size_reduction_pct?: number;
    int8_latency_speedup_x?: number;
  };
}

export interface PredictionScore {
  label: number;
  confidence: number;
}

export interface PredictionRequest {
  sample_index: number;
  split: 'train' | 'test';
  top_k: number;
}

export interface PredictionResponse {
  checkpoint_filename: string;
  sample_index: number;
  split: 'train' | 'test';
  predicted_label: number;
  true_label: number;
  confidence: number;
  matches_label: boolean;
  top_predictions: PredictionScore[];
  image_pixels: number[][];
}

export interface ModelAnalysis {
  model_class: string;
  input_shape: number[];
  total_params: number;
  trainable_params: number;
  inference_latency_ms: number;
  file_size_mb: number | null;
  layers: Array<{
    name: string;
    type: string;
    params: number;
    in_features?: number;
    out_features?: number;
  }>;
}

export interface TrainRequest {
  learning_rate: number;
  batch_size: number;
  epochs: number;
  optimizer: 'adam' | 'sgd';
  experiment_name: string;
  dataset_name?: string;
}

export interface TrainResponse {
  best_val_accuracy: number;
  run_name: string;
  checkpoint_path: string;
  dataset_name?: string;
  dataset_kind?: string;
  history: {
    train_loss: number[];
    train_accuracy: number[];
    val_loss: number[];
    val_accuracy: number[];
  };
}
