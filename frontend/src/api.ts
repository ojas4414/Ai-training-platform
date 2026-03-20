import axios, { isAxiosError } from 'axios';

import type {
  DatasetFile,
  DatasetUploadResponse,
  ExperimentsResponse,
  HealthResponse,
  HpoResult,
  JobStatus,
  MlflowRunsResponse,
  ModelAnalysis,
  ModelFile,
  ModelUploadResponse,
  OnnxComparison,
  PredictionRequest,
  PredictionResponse,
  TrainRequest,
  TrainResponse,
} from './types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 600_000,
});

export function getApiErrorMessage(error: unknown): string {
  if (isAxiosError<{ detail?: string }>(error)) {
    return error.response?.data?.detail ?? error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Request failed';
}

export const healthCheck = (): Promise<HealthResponse> =>
  api.get('/health').then(response => response.data);

export const getExperiments = (): Promise<ExperimentsResponse> =>
  api.get('/experiments').then(response => response.data);

export const getMlflowRuns = (limit = 12, offset = 0): Promise<MlflowRunsResponse> =>
  api.get('/experiments/mlflow', { params: { limit, offset } }).then(response => response.data);

export const listModels = (): Promise<{ models: ModelFile[] }> =>
  api.get('/models').then(response => response.data);

export const uploadModel = (file: File): Promise<ModelUploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/models/upload', formData).then(response => response.data);
};

export const listDatasets = (): Promise<{ datasets: DatasetFile[] }> =>
  api.get('/datasets').then(response => response.data);

export const uploadDataset = (file: File): Promise<DatasetUploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/datasets/upload', formData).then(response => response.data);
};

export const trainModel = (payload: TrainRequest): Promise<TrainResponse> =>
  api.post('/train', payload).then(response => response.data);

export const createTrainJob = (payload: TrainRequest): Promise<JobStatus<TrainResponse>> =>
  api.post('/train/jobs', payload).then(response => response.data);

export const runHpo = (
  n_trials: number,
  n_jobs = 2,
  experiment_name = 'ai-training-platform',
  dataset_name?: string,
): Promise<HpoResult> =>
  api.post('/hpo', { n_trials, n_jobs, experiment_name, dataset_name }).then(response => response.data);

export const createHpoJob = (
  n_trials: number,
  n_jobs = 2,
  experiment_name = 'ai-training-platform',
  dataset_name?: string,
): Promise<JobStatus<HpoResult>> =>
  api.post('/hpo/jobs', { n_trials, n_jobs, experiment_name, dataset_name }).then(response => response.data);

export const exportOnnx = (filename: string): Promise<OnnxComparison> =>
  api.post(`/export/${filename}`).then(response => response.data);

export const createExportJob = (filename: string): Promise<JobStatus<OnnxComparison>> =>
  api.post(`/export/${filename}/jobs`).then(response => response.data);

export const analyseModel = (filename: string): Promise<ModelAnalysis> =>
  api.get(`/analyse/${filename}`).then(response => response.data);

export const createAnalysisJob = (filename: string): Promise<JobStatus<ModelAnalysis>> =>
  api.post(`/analyse/${filename}/jobs`).then(response => response.data);

export const predictModel = (filename: string, payload: PredictionRequest): Promise<PredictionResponse> =>
  api.post(`/predict/${filename}`, payload).then(response => response.data);

export const getJobStatus = <T = Record<string, unknown>>(jobId: string): Promise<JobStatus<T>> =>
  api.get(`/jobs/${jobId}`).then(response => response.data);

const delay = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));

export async function waitForJob<T = Record<string, unknown>>(
  jobId: string,
  options?: {
    intervalMs?: number;
    timeoutMs?: number;
    onUpdate?: (job: JobStatus<T>) => void;
  },
): Promise<JobStatus<T>> {
  const intervalMs = options?.intervalMs ?? 1000;
  const timeoutMs = options?.timeoutMs ?? 600_000;
  const startedAt = Date.now();

  while (true) {
    const job = await getJobStatus<T>(jobId);
    options?.onUpdate?.(job);

    if (job.status === 'completed' || job.status === 'failed') {
      return job;
    }

    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Job ${jobId} timed out after ${Math.round(timeoutMs / 1000)} seconds`);
    }

    await delay(intervalMs);
  }
}
