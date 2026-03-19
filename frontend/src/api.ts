// src/api.ts - Axios API client
import axios, { isAxiosError } from 'axios';
import type {
  ExperimentsResponse,
  HpoResult,
  MlflowRun,
  ModelAnalysis,
  ModelFile,
  OnnxComparison,
  PredictionRequest,
  PredictionResponse,
  TrainRequest,
  TrainResponse,
} from './types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({ baseURL: BASE_URL, timeout: 600_000 });

export function getApiErrorMessage(error: unknown): string {
  if (isAxiosError<{ detail?: string }>(error)) {
    return error.response?.data?.detail ?? error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Request failed';
}

export const healthCheck = () => api.get('/health').then(r => r.data);

export const getExperiments = (): Promise<ExperimentsResponse> =>
  api.get('/experiments').then(r => r.data);

export const getMlflowRuns = (): Promise<{ runs: MlflowRun[]; total: number }> =>
  api.get('/experiments/mlflow').then(r => r.data);

export const listModels = (): Promise<{ models: ModelFile[] }> =>
  api.get('/models').then(r => r.data);

export const trainModel = (payload: TrainRequest): Promise<TrainResponse> =>
  api.post('/train', payload).then(r => r.data);

export const runHpo = (
  n_trials: number,
  n_jobs = 2,
  experiment_name = 'ai-training-platform',
): Promise<HpoResult> =>
  api.post('/hpo', { n_trials, n_jobs, experiment_name }).then(r => r.data);

export const exportOnnx = (filename: string): Promise<OnnxComparison> =>
  api.post(`/export/${filename}`).then(r => r.data);

export const analyseModel = (filename: string): Promise<ModelAnalysis> =>
  api.get(`/analyse/${filename}`).then(r => r.data);

export const predictModel = (filename: string, payload: PredictionRequest): Promise<PredictionResponse> =>
  api.post(`/predict/${filename}`, payload).then(r => r.data);
