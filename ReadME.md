<p align="center">
  <img src="docs/assets/hero_banner.png" alt="AI Training Platform" width="100%" />
</p>

<h1 align="center">🧠 AI Training & MLOps Platform</h1>

<p align="center">
  <em>An end-to-end machine learning lifecycle platform with a cinematic 3D interface, automated hyperparameter optimization, and one-click model export.</em>
</p>

<p align="center">
  <a href="https://www.python.org/"><img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" /></a>
  <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/FastAPI-0.110+-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" /></a>
  <a href="https://pytorch.org/"><img src="https://img.shields.io/badge/PyTorch-2.0+-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white" alt="PyTorch" /></a>
  <a href="https://mlflow.org/"><img src="https://img.shields.io/badge/MLflow-2.10+-0194E2?style=for-the-badge&logo=mlflow&logoColor=white" alt="MLflow" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge" alt="MIT License" /></a>
</p>

<p align="center">
  <a href="#-key-features">Features</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-api-reference">API</a> •
  <a href="#-project-structure">Structure</a> •
  <a href="#-testing">Testing</a>
</p>

---

## ✨ Key Features

### 🎮 Cinematic 3D Workspace
A scroll-driven, immersive 3D environment built with **React Three Fiber** and **Three.js**. The workspace maps each stage of the ML lifecycle onto high-fidelity visual waypoints — a **Neural Hub** for training, a **GPU Rack** for experimentation, and a **Radar Dish** for model analysis — creating spacial context that turns abstract ML operations into tangible, navigable objects.

### 🚀 One-Click Training
Configure learning rate, batch size, optimizer, and epochs through the dashboard or the REST API. The platform trains a PyTorch neural network on MNIST, tracks every metric to **MLflow**, and saves the best-performing checkpoint automatically with cosine annealing LR scheduling.

### 🔬 Automated Hyperparameter Optimization
Runs **Optuna** Bayesian search across a 7-dimensional hyperparameter space (learning rate, batch size, optimizer, hidden size, network depth, dropout, and epoch count) with **TPE sampling** and **median pruning** to terminate bad trials early. Supports parallel workers via `n_jobs`.

### 📊 Experiment Tracking & Comparison
Every training run and HPO trial is logged to **MLflow** with full parameter-metric lineage. The dashboard queries MLflow directly to display run history, metric comparison, and best-run identification.

### 🧪 Model Lab
Inspect any saved checkpoint with detailed architecture analysis: per-layer parameter counts, inference latency benchmarks, file size, and a full `torchsummary` breakdown. Export models to **ONNX** format with automatic **INT8 dynamic quantization**, then compare PyTorch vs ONNX vs quantized performance side-by-side.

### 🔮 Live Inference
Upload a handwritten digit image or select a sample from the MNIST dataset. The platform auto-preprocesses the input (grayscale conversion, 28×28 resize, background auto-inversion for MNIST compatibility, normalization) and returns top-k predictions with confidence scores and a pixel-level preview.

### ⚡ Intelligent Caching
A cache abstraction layer with TTL support that works with **Redis** in production and falls back to an in-memory dictionary for local development — preventing duplicate training runs for identical configurations.

### 📡 Real-Time Hardware Telemetry
A WebSocket endpoint streams CPU and GPU utilization at 2 Hz, with NVML support for real NVIDIA GPU metrics. The 3D workspace visualizes this telemetry as a live HUD overlay.

---

## 🏗 Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     FRONTEND  (React 19 + Vite)                  │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │ Cinematic 3D │  │   Mission    │  │     Live Inference      │ │
│  │  Workspace   │  │   Control    │  │   (Image Upload /       │ │
│  │  (R3F/Three) │  │  Dashboard   │  │    Dataset Sample)      │ │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬──────────────┘ │
│         │                 │                      │                │
│         └─────────────────┼──────────────────────┘                │
│                           │  HTTP / WebSocket                     │
└───────────────────────────┼──────────────────────────────────────┘
                            │
┌───────────────────────────┼──────────────────────────────────────┐
│                    BACKEND  (FastAPI + Python)                    │
│                           │                                      │
│  ┌────────────────────────▼────────────────────────────────────┐ │
│  │                    REST API Layer                           │ │
│  │  /train  /hpo  /experiments  /models  /predict  /export    │ │
│  │  /analyse  /health  /cache/stats  /ws/telemetry            │ │
│  └────────┬───────────────┬──────────────────┬────────────────┘ │
│           │               │                  │                   │
│  ┌────────▼──────┐ ┌──────▼───────┐ ┌───────▼──────────┐       │
│  │ TrainEngine   │ │ HPO Search   │ │ Model Analysis   │       │
│  │ (PyTorch +    │ │ (Optuna +    │ │ + ONNX Export    │       │
│  │  MLflow)      │ │  TPE/Pruner) │ │ + INT8 Quant     │       │
│  └───────────────┘ └──────────────┘ └──────────────────┘       │
│           │                                                      │
│  ┌────────▼──────────────────────────────────────────────────┐  │
│  │              Cache Layer  (Redis / In-Memory)             │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Training Pipeline

1. **Config** → User submits hyperparameters via dashboard or API
2. **Data** → MNIST is loaded, normalized (`μ=0.1307, σ=0.3081`), and split 80/20 with a fixed seed for reproducibility
3. **Model** → `SimpleNN` (Flatten → Linear → BatchNorm → ReLU → Dropout → Linear) or `FlexibleNN` (variable depth/width for HPO)
4. **Training** → `TrainEngine` handles the epoch loop with gradient accumulation, cosine LR annealing, and best-checkpoint tracking
5. **Logging** → Every epoch's `train_loss`, `train_accuracy`, `val_loss`, `val_accuracy` is pushed to MLflow
6. **Checkpoint** → The epoch with the highest `val_accuracy` is saved as a `.pth` containing weights, config, accuracy, and full history

---

## 🛠 Tech Stack

| Layer | Technologies | Purpose |
|:---|:---|:---|
| **Frontend** | React 19, TypeScript, Vite 8 | Reactive component-based UI with HMR |
| **3D Engine** | Three.js, React Three Fiber, Drei, Postprocessing | Declarative 3D scene graph with HDRI lighting, bloom, and depth of field |
| **Animation** | GSAP, Framer Motion, Lenis | Scroll-linked cinematic transitions and magnetic cursor effects |
| **Charts** | Recharts | Training metric visualization and sparklines |
| **Backend** | FastAPI, Uvicorn, Pydantic v2 | Async-capable, type-safe API with auto-generated OpenAPI docs |
| **ML Training** | PyTorch 2.0+, Torchvision | Model definition, training loops, CUDA support |
| **Experiment Tracking** | MLflow 2.10+ | Parameter/metric logging, artifact management, run comparison |
| **HPO** | Optuna 3.5+ | TPE sampler, median pruner, parallel trial execution |
| **Model Export** | ONNX, ONNX Runtime | Cross-platform export and INT8 dynamic quantization benchmarking |
| **Caching** | Redis 5.0+ (optional) | Response caching with TTL; in-memory fallback for local dev |
| **Telemetry** | psutil, pynvml | CPU/GPU utilization streaming over WebSocket |
| **Testing** | pytest, httpx | Backend unit and integration tests |
| **CI** | GitHub Actions | Automated test + lint + build on every push/PR |
| **Deployment** | Docker, Docker Compose, Render | Containerized deployment with health checks |

---

## 🚀 Getting Started

### Prerequisites

- **Python** 3.10+
- **Node.js** 18+
- **Docker** & Docker Compose *(optional, for containerized deployment)*

### Backend Setup

```bash
# Create and activate virtual environment
python -m venv .venv

# Linux / macOS
source .venv/bin/activate

# Windows PowerShell
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Launch API server (auto-reload enabled)
python -m uvicorn backend.api.main:app --reload
```

> **API available at** `http://localhost:8000` — interactive docs at `http://localhost:8000/docs`

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

> **UI available at** `http://localhost:5173`

### Docker (Full Stack)

```bash
docker compose up --build
```

### Environment Variables

| Variable | Default | Description |
|:---|:---|:---|
| `MLFLOW_TRACKING_URI` | `mlruns` | MLflow tracking directory or server URI |
| `REDIS_URL` | *(unset)* | Redis connection URL; omit for in-memory cache |
| `APP_HOST` | `127.0.0.1` | Backend bind address |
| `PORT` | `8000` | Backend port |
| `CORS_ALLOW_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |
| `VITE_API_URL` | `http://localhost:8000` | Backend URL used by the frontend |

---

## 📡 API Reference

All endpoints are documented interactively at `/docs` (Swagger UI) when the backend is running.

| Method | Endpoint | Description |
|:---|:---|:---|
| `GET` | `/health` | Service status, MLflow URI, device (CPU/CUDA) |
| `GET` | `/cache/stats` | Cache hit/miss statistics |
| `WS` | `/ws/telemetry` | Real-time CPU/GPU telemetry stream (2 Hz) |
| `POST` | `/train` | Launch a training run with custom hyperparameters |
| `POST` | `/hpo` | Run Optuna hyperparameter search (configurable trials & workers) |
| `GET` | `/experiments` | Retrieve saved experiment results (manual + HPO) |
| `GET` | `/experiments/mlflow` | Query MLflow for all runs, params, and metrics |
| `GET` | `/models` | List all saved `.pth` checkpoints with size and timestamp |
| `GET` | `/analyse/{checkpoint}` | Deep architecture analysis: layers, params, latency |
| `POST` | `/predict/{checkpoint}` | Run inference on dataset sample or uploaded image |
| `POST` | `/export/{checkpoint}` | Export to ONNX + INT8 quantization with benchmark |

### Example: Train a Model

```bash
curl -X POST http://localhost:8000/train \
  -H "Content-Type: application/json" \
  -d '{
    "learning_rate": 0.001,
    "batch_size": 64,
    "epochs": 10,
    "optimizer": "adam"
  }'
```

### Example: Run HPO Search

```bash
curl -X POST http://localhost:8000/hpo \
  -H "Content-Type: application/json" \
  -d '{"n_trials": 15, "n_jobs": 2}'
```

---

## 📂 Project Structure

```
ai-training-platform/
├── backend/
│   ├── api/
│   │   ├── main.py              # FastAPI app — all endpoints
│   │   └── schemas.py           # Pydantic request/response models
│   ├── ml/
│   │   ├── train_engine.py      # Core training loop with MLflow + Optuna integration
│   │   └── train_mnist.py       # SimpleNN model definition + default training
│   └── cache.py                 # Cache abstraction (Redis + in-memory fallback)
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CinematicScene.tsx        # Main 3D scroll-driven scene
│   │   │   ├── CinematicExperience.tsx   # Scene orchestration + camera waypoints
│   │   │   ├── Dashboard.tsx             # Mission Control dashboard container
│   │   │   ├── TrainTab.tsx              # Training configuration UI
│   │   │   ├── ExperimentsTab.tsx        # MLflow experiment browser
│   │   │   ├── HPOTab.tsx                # Hyperparameter optimization UI
│   │   │   ├── ModelsTab.tsx             # Model lab — analysis, export, quantization
│   │   │   └── models/                   # 3D model components (GPURack, RadarDish, etc.)
│   │   ├── hooks/
│   │   │   ├── useHardwareTelemetry.ts   # WebSocket hook for GPU/CPU telemetry
│   │   │   ├── useDarkMode.ts            # Theme persistence
│   │   │   ├── useMagnetic.ts            # Magnetic cursor physics
│   │   │   └── useParallax.ts            # Parallax scroll effects
│   │   ├── App.tsx                       # Root — cinematic hub ↔ dashboard router
│   │   └── api.ts                        # Axios API client
│   └── public/
│       ├── assets3d/                     # Optimized .glb 3D models
│       └── hdri/                         # Studio HDRI for PBR lighting
│
├── scripts/
│   ├── hpo_search.py            # Optuna search with FlexibleNN + TPE + pruning
│   ├── run_experiments.py       # Manual multi-config experiment runner
│   ├── analyse_model.py         # Checkpoint analysis (params, layers, latency)
│   ├── export_onnx.py           # ONNX export + INT8 quantization + benchmarking
│   └── train_best.py            # Best-config training script
│
├── configs/
│   ├── train_config.yaml        # Default training configuration
│   └── config_lr_*.yaml         # Learning rate comparison configs
│
├── tests/                       # pytest suite — API + training + caching
├── .github/workflows/ci.yml     # CI: test → lint → build on push/PR
├── Dockerfile                   # Backend container image
├── docker-compose.yml           # Full-stack orchestration (API + Redis)
├── requirements.txt             # Python dependencies
└── README.md
```

---

## 🧪 Testing

The project includes a comprehensive test suite covering API endpoints, training logic, caching, and HPO:

```bash
# Run all backend tests
python -m pytest -q

# Run with verbose output
python -m pytest -v
```

**CI Pipeline** — GitHub Actions runs automatically on every push and pull request:
1. Python syntax check (`compileall`)
2. Backend test suite (`pytest`)
3. Frontend lint (`eslint`)
4. Frontend production build (`tsc` + `vite build`)

---

## 🔧 Configuration

Training is driven by YAML configs in `configs/`:

```yaml
# configs/train_config.yaml
model: simple_nn
dataset: mnist
learning_rate: 0.001
batch_size: 64
epochs: 10
optimizer: adam
checkpoint_dir: models/
results_dir: results/
mlflow_experiment: ai-training-platform
```

HPO search space (configured in `scripts/hpo_search.py`):

| Parameter | Range | Scale |
|:---|:---|:---|
| Learning Rate | `1e-4` — `1e-1` | Log |
| Batch Size | `32`, `64`, `128` | Categorical |
| Optimizer | `adam`, `sgd` | Categorical |
| Hidden Size | `128`, `256`, `512` | Categorical |
| Num Layers | `1` — `3` | Integer |
| Dropout | `0.1` — `0.5` | Uniform |
| Epochs | `5` — `15` | Integer |

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.

---

<p align="center">
  Built with ❤️ using PyTorch, FastAPI, React, and Three.js
</p>
