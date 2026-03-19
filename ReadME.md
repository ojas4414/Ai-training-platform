# AI Training Platform

An end-to-end training and experiment dashboard for MNIST built with PyTorch, MLflow, Optuna, FastAPI, React, and Docker.

## What it does

- trains a PyTorch model on MNIST
- tracks runs and metrics with MLflow
- compares manual experiments
- runs Optuna hyperparameter search
- analyzes saved checkpoints
- exports models to ONNX and benchmarks latency
- exposes the workflow through a FastAPI backend and React frontend

## Current features

### Backend

- reusable `TrainEngine` for training and validation
- `/train` endpoint for single-run training
- `/hpo` endpoint for Optuna search
- parallel HPO worker control via `n_jobs`
- `/experiments` and `/experiments/mlflow` endpoints for results
- `/models`, `/predict/{checkpoint}`, `/analyse/{checkpoint}`, and `/export/{checkpoint}` endpoints

### Frontend

- experiment dashboard
- training form with live metric curves
- HPO tab with best-trial visualization
- model lab for architecture analysis and ONNX export
- model lab sample prediction flow for saved checkpoints

### Tooling

- Dockerfile and `docker-compose.yml`
- YAML config-driven training
- saved checkpoints in `models/`
- JSON summaries in `results/`

## Project structure

```text
backend/
  api/          FastAPI app and schemas
  ml/           Training engine and MNIST model
configs/        YAML experiment configs
frontend/       React + TypeScript + Vite dashboard
models/         Saved .pth checkpoints
results/        Saved JSON reports
scripts/        Experiment, HPO, analysis, and export scripts
```

## Local setup

### Backend

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn backend.api.main:app --reload
```

Backend runs at `http://localhost:8000`.

If you want the backend to read host, port, MLflow, and CORS settings from env vars, use:

```powershell
$env:APP_HOST="127.0.0.1"
$env:PORT="8000"
$env:RELOAD="true"
$env:MLFLOW_TRACKING_URI="mlruns"
$env:REDIS_URL="redis://localhost:6379/0"
$env:CORS_ALLOW_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
$env:CORS_ALLOW_CREDENTIALS="false"
python -m backend.api.main
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

For local development, Vite proxies API calls to `http://localhost:8000`.

### Docker

```powershell
docker compose up --build
```

`docker compose` reads the root `.env` file automatically. Start by copying [\.env.example](c:/Users/Ojas/Desktop/ai-training-platform/.env.example) to `.env`, then adjust values for your machine or deployment target.

## Environment variables

The backend supports these runtime settings:

- `APP_HOST`: host for `python -m backend.api.main`
- `PORT`: backend port
- `RELOAD`: `true` for local reloads, `false` for containers
- `MLFLOW_TRACKING_URI`: local path or remote MLflow URI
- `REDIS_URL`: Redis cache URL. Leave unset to fall back to in-memory cache
- `CORS_ALLOW_ORIGINS`: comma-separated frontend origins
- `CORS_ALLOW_CREDENTIALS`: `true` or `false`

For Docker, the same variables are wired through [docker-compose.yml](c:/Users/Ojas/Desktop/ai-training-platform/docker-compose.yml), so local runs and container runs now use the same backend startup path.

## Important scripts

```powershell
python scripts\run_experiments.py
python scripts\hpo_search.py
python scripts\train_best.py
python scripts\analyse_model.py models\best_model.pth
python scripts\export_onnx.py models\best_model.pth
```

## API endpoints

- `GET /health`
- `GET /cache/stats`
- `POST /train`
- `POST /hpo`
- `GET /experiments`
- `GET /experiments/mlflow`
- `GET /models`
- `POST /predict/{checkpoint_filename}`
- `GET /analyse/{checkpoint_filename}`
- `POST /export/{checkpoint_filename}`

## Saved experiment note

The current manual experiment results in `results/results.json` show:

- learning rate `0.1` underperformed
- learning rate `0.01` was strong
- learning rate `0.001` performed best among the saved manual runs

## Current gaps

These are the next improvements planned for the repo:

- more production-style model serving beyond the current sample-prediction API
- live deployment for backend and frontend
- DVC, auth, and stronger MLOps features
