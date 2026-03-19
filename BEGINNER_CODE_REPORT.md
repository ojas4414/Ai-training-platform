# Beginner Code Report: AI Training Platform

## 1. What this project is

This repository is a small machine learning training platform built around the MNIST dataset.

In simple terms, it does five main jobs:

1. It trains a neural network on handwritten digit images.
2. It compares different training settings like learning rate.
3. It can search for better hyperparameters automatically with Optuna.
4. It exposes these actions through a FastAPI backend.
5. It can inspect saved models and export them to ONNX.

If you are a beginner, the easiest way to think about this project is:

- `backend/ml/` contains the actual machine learning logic.
- `backend/api/` turns that logic into web endpoints.
- `scripts/` contains command-line helpers for experiments and utilities.
- `configs/` stores YAML settings.
- `models/` stores saved model files.
- `results/` stores experiment summaries.
- `data/` stores the MNIST dataset files.

This is a backend-only project. There is no frontend in the repo right now.

## 2. High-level architecture

Here is the full flow in plain English:

1. A training config is created.
2. The MNIST dataset is loaded and normalized.
3. A PyTorch model is created.
4. `TrainEngine` splits the dataset into training and validation sets.
5. The model trains for several epochs.
6. Loss and accuracy are logged to MLflow.
7. The best model weights are saved as a checkpoint.
8. Other scripts or API endpoints can list, analyze, compare, or export those checkpoints.

ASCII flow:

```text
Config / API Request
        |
        v
Load MNIST dataset
        |
        v
Build model (SimpleNN or FlexibleNN)
        |
        v
TrainEngine
  - DataLoader
  - optimizer
  - loss
  - scheduler
  - validation
  - checkpoint save
  - MLflow logging
        |
        +--> models/*.pth
        +--> results/*.json
        +--> MLflow runs
        +--> optional analysis / ONNX export
```

## 3. Folder-by-folder explanation

### `backend/`

This is the main Python package.

- `backend/ml/` contains model training code.
- `backend/api/` contains the FastAPI server.
- `backend/__init__.py` exists correctly.
- `backend/_init_.py` also exists, but this is a typo-named extra file and does not help Python packaging.

### `configs/`

This folder holds YAML files with training settings.

- `train_config.yaml` is the main default config.
- `config_lr_1.yaml`, `config_lr_2.yaml`, and `config_lr_3.yaml` are manual experiment configs used for learning-rate comparison.

### `data/`

This contains the downloaded MNIST dataset files.

- The repo currently includes `data/MNIST/raw/...` files.
- That means the dataset has already been downloaded at least once.

### `models/`

This contains saved PyTorch checkpoint files (`.pth`).

These are training outputs, not source code.

### `results/`

This contains JSON summaries of experiments and utility outputs.

- `results.json` has manual experiment results.
- `best_config.json` is present but currently empty.
- `resukts.json` is also present, but it is typo-named and empty.

### `scripts/`

This contains helper scripts for:

- manual experiments
- hyperparameter search
- training best models
- model analysis
- ONNX export

One of these scripts is incomplete and currently broken: `scripts/train_best.py`.

## 4. Dependency explanation

`requirements.txt` shows the technology stack:

- `torch`, `torchvision`, `torchsummary`: core deep learning and model inspection
- `mlflow`: experiment tracking
- `optuna`: hyperparameter optimization
- `fastapi`, `uvicorn`, `pydantic`: API layer
- `onnx`, `onnxruntime`: model export and inference outside PyTorch
- `pyyaml`, `numpy`: utilities and config handling

Why these matter:

- PyTorch trains the model.
- MLflow records what happened during training.
- Optuna automatically searches for better settings.
- FastAPI exposes the whole thing as a service.
- ONNX makes the trained model easier to deploy elsewhere.

## 5. The most important file: `backend/ml/train_engine.py`

File focus: `backend/ml/train_engine.py:17`

This is the heart of the project. Almost every training path eventually goes through `TrainEngine`.

### What `TrainEngine` is responsible for

It handles:

- device selection (`cpu` or `cuda`)
- splitting the dataset into train and validation subsets
- building DataLoaders
- picking the optimizer
- defining the loss function
- running epochs
- saving the best checkpoint
- logging everything to MLflow
- supporting Optuna pruning

### Constructor: `__init__`

Relevant area: `backend/ml/train_engine.py:24`

Important steps:

1. The code picks the device at `:25`.
2. The model is moved to that device at `:28`.
3. The dataset is split 80/20 into train and validation at `:30-36`.
4. Two DataLoaders are created at `:38-51`.
5. Hyperparameters are read from the config at `:53-55`.
6. The optimizer is chosen at `:57-65`.
7. The loss function is set to `CrossEntropyLoss` at `:67`.
8. A cosine learning-rate scheduler is created at `:68-70`.
9. Training history lists are initialized at `:72-77`.

Beginner explanation:

- A `DataLoader` gives the model data in batches instead of all at once.
- `random_split` makes a validation set so the project can measure how well the model generalizes.
- `CrossEntropyLoss` is the standard loss for multi-class classification like digits `0-9`.
- `Adam` and `SGD` are two different optimization algorithms.
- A scheduler changes the learning rate over time.

### Private helper: `_run_epoch`

Relevant area: `backend/ml/train_engine.py:83`

This function runs one full pass over a dataset loader.

What happens inside:

1. `self.model.train(train)` switches the model between training and evaluation mode.
2. The loop reads `images, labels` from the loader.
3. Inputs and labels are moved to the selected device.
4. The model predicts outputs.
5. Loss is computed.
6. If `train=True`, gradients are cleared, backpropagation runs, and optimizer step updates weights.
7. Loss and accuracy are accumulated.
8. Average loss and accuracy are returned.

Beginner explanation:

- During training, the model updates its weights.
- During validation, the model does not update weights.
- `torch.set_grad_enabled(train)` is a performance optimization so gradients are only tracked when needed.
- `torch.max(outputs, 1)` picks the class with the highest score.

### Public method: `train`

Relevant area: `backend/ml/train_engine.py:111`

This is the full training loop.

Key steps:

1. Set the MLflow experiment at `:125`.
2. Start an MLflow run at `:127`.
3. Log hyperparameters at `:128-135`.
4. Loop through epochs at `:140`.
5. Run one training epoch and one validation epoch at `:141-142`.
6. Step the scheduler at `:143`.
7. Store metrics in memory at `:145-149`.
8. Log metrics to MLflow at `:151-160`.
9. Track the best validation model at `:168-171`.
10. If running inside Optuna, report intermediate results and optionally prune at `:173-180`.
11. Save the best checkpoint at `:182-195`.
12. Log final best accuracy at `:197`.

Why "best model" matters:

The model can sometimes perform best before the final epoch. This code saves the checkpoint with the best validation accuracy, not just the last epoch.

### What a saved checkpoint contains

At `backend/ml/train_engine.py:185-192`, the checkpoint stores:

- `model_state_dict`
- `config`
- `best_val_accuracy`
- `history`

That is good beginner-friendly design because the saved file contains both model weights and useful training metadata.

## 6. The default model: `backend/ml/train_mnist.py`

File focus: `backend/ml/train_mnist.py:13`

This file defines the basic MNIST model and a default training entry point.

### `SimpleNN`

The model class is at `backend/ml/train_mnist.py:13-28`.

Layer-by-layer explanation:

1. `nn.Flatten()` turns each `28 x 28` image into a single vector of length `784`.
2. `nn.Linear(28 * 28, hidden_size)` maps the input to a hidden layer.
3. `nn.BatchNorm1d(hidden_size)` stabilizes training.
4. `nn.ReLU()` adds non-linearity.
5. `nn.Dropout(0.3)` randomly drops some activations during training to reduce overfitting.
6. `nn.Linear(hidden_size, 10)` outputs one score for each digit class.

This is not a convolutional neural network. It is a simple fully connected network.

With `hidden_size=256`, this architecture has `204,042` trainable parameters.

### `train()`

The training function is at `backend/ml/train_mnist.py:31`.

What it does:

1. Reads YAML config from `configs/train_config.yaml`.
2. Creates image transforms.
3. Loads the MNIST training set.
4. Builds `SimpleNN`.
5. Creates `TrainEngine`.
6. Builds a checkpoint path based on the learning rate.
7. Calls `engine.train(...)`.
8. Prints the best validation accuracy.

### Why normalization is used

At `backend/ml/train_mnist.py:35-38`, the transform includes:

- `ToTensor()`
- `Normalize((0.1307,), (0.3081,))`

This converts pixel data to tensors and standardizes the values based on MNIST statistics. Normalized inputs usually train more smoothly.

## 7. The API layer: `backend/api/schemas.py`

File focus: `backend/api/schemas.py`

This file defines request and response shapes using Pydantic models.

Why this matters:

- It validates incoming data.
- It documents the API.
- It ensures consistent response formats.

### Main schema classes

`TrainRequest`

- learning rate
- batch size
- epochs
- optimizer
- experiment name
- optional run name

`HPORequest`

- number of Optuna trials
- experiment name

`HPOResult`

- best trial number
- best validation accuracy
- best parameter set
- all trials

`ModelAnalysis`

- model class
- parameter counts
- latency
- file size
- layer breakdown
- torchsummary string

`TrainResponse`

- best validation accuracy
- run name
- checkpoint path
- history

Beginner takeaway:

Schemas are like contracts between the frontend or API client and the backend.

## 8. The API server: `backend/api/main.py`

File focus: `backend/api/main.py`

This file turns the ML utilities into HTTP endpoints.

### App setup

At `backend/api/main.py:32-52`:

- `lifespan()` sets MLflow tracking URI to `mlruns`.
- `FastAPI(...)` creates the app.
- CORS is enabled for all origins.

Beginner note:

`allow_origins=["*"]` is easy for development, but too open for production unless intentionally controlled.

### `/health`

Relevant area: `backend/api/main.py:59-66`

Returns:

- service status
- current MLflow tracking URI
- whether the machine is using CPU or CUDA

This is a quick "is the backend alive?" endpoint.

### `/train`

Relevant area: `backend/api/main.py:73-115`

This endpoint:

1. receives user-selected hyperparameters
2. rebuilds the same MNIST dataset and transform
3. creates `SimpleNN`
4. creates `TrainEngine`
5. runs training
6. returns best accuracy, run name, checkpoint path, and full history

Beginner insight:

This endpoint is synchronous. That means the request waits until training finishes. For small experiments that is okay, but for real production systems, training jobs are usually queued in the background.

### `/hpo`

Relevant area: `backend/api/main.py:122-136`

This endpoint runs the Optuna search from `scripts/hpo_search.py` and returns the search result.

Again, this is also synchronous and can take a long time.

### `/experiments`

Relevant area: `backend/api/main.py:143-163`

This reads local JSON files and returns:

- manual experiment results from `results/results.json`
- HPO results from `results/best_hpo_config.json`

In the current workspace, `results/results.json` exists, but `results/best_hpo_config.json` does not.

### `/experiments/mlflow`

Relevant area: `backend/api/main.py:166-192`

This uses `MlflowClient` to query experiment runs directly from MLflow.

It returns:

- run id
- run name
- experiment name
- status
- start time
- params
- metrics

This is more dynamic than reading a local JSON file.

### `/analyse/{checkpoint_filename}`

Relevant area: `backend/api/main.py:199-216`

This endpoint:

1. checks whether a checkpoint exists
2. loads the analysis utility
3. loads `SimpleNN`
4. analyzes the checkpoint
5. saves JSON output into `results/`
6. returns the analysis

### `/models`

Relevant area: `backend/api/main.py:219-234`

This lists available `.pth` files in `models/` with:

- filename
- size in MB
- modification time

### `/export/{checkpoint_filename}`

Relevant area: `backend/api/main.py:241-250`

This exports a `.pth` checkpoint to ONNX and returns a size and latency comparison.

### Design observations on `main.py`

Good parts:

- clean endpoint separation
- response models for important endpoints
- useful utility endpoints for inspection and export

Weak parts:

- several unused imports exist: `os`, `subprocess`, and `BackgroundTasks`
- the file modifies `sys.path`, which is usually a sign the project packaging could be cleaner
- training and HPO are blocking requests

## 9. Manual experiment script: `scripts/run_experiments.py`

File focus: `scripts/run_experiments.py`

This script compares a few fixed YAML configs.

How it works:

1. A hardcoded list of config files is defined at `:34-38`.
2. MNIST is loaded once at `:40-45`.
3. For each config:
4. The YAML is read.
5. A fresh `SimpleNN` is created.
6. `TrainEngine` trains the model.
7. Best accuracy is added to a results list.
8. `results/results.json` is written.
9. The best config is selected with `max(...)`.
10. `results/best_config.json` should also be written.

What this script is trying to teach:

It is a simple controlled experiment where only the learning rate changes.

The three config files are:

- `config_lr_1.yaml` -> learning rate `0.1`
- `config_lr_2.yaml` -> learning rate `0.01`
- `config_lr_3.yaml` -> learning rate `0.001`

### Actual recorded manual results

From `results/results.json`:

- `0.1` -> `76.775`
- `0.01` -> `97.3833`
- `0.001` -> `98.185`

Beginner interpretation:

- `0.1` was too aggressive and performed badly.
- `0.01` worked much better.
- `0.001` performed best in the saved results.

### Important code smell here

This script redefines `SimpleNN` instead of importing it from `backend/ml/train_mnist.py`.

That is duplication. If the model changes in one file and not the other, behavior can drift.

## 10. Hyperparameter optimization: `scripts/hpo_search.py`

File focus: `scripts/hpo_search.py`

This is the most advanced script in the repository.

### What Optuna is doing here

Instead of manually trying a few settings, Optuna automatically searches the space of possible hyperparameters.

### `FlexibleNN`

Defined at `scripts/hpo_search.py:31-56`.

Unlike `SimpleNN`, this model can vary:

- hidden layer size
- number of layers
- dropout rate

Interesting detail:

At `:50`, the hidden size shrinks after each layer:

```python
hidden_size = max(hidden_size // 2, 64)
```

That creates a pyramid-style network.

### Search space

Inside `objective()` at `scripts/hpo_search.py:76-84`, Optuna chooses:

- learning rate: `1e-4` to `1e-1` on a log scale
- batch size: `32`, `64`, `128`
- optimizer: `adam` or `sgd`
- hidden size: `128`, `256`, `512`
- number of layers: `1` to `3`
- dropout: `0.1` to `0.5`
- epochs: `5` to `15`

### Why this script is useful

It lets the project search both:

- training hyperparameters
- model architecture choices

That makes it more than just a learning-rate comparison.

### Optuna setup

At `scripts/hpo_search.py:128-135`:

- `TPESampler(seed=42)` gives reproducible probabilistic search
- `MedianPruner(...)` stops bad trials early to save time

### Output

At the end, the script writes `results/best_hpo_config.json`.

In the current workspace, that file is not present yet, so HPO results either have not been generated here or were not saved into version control.

## 11. Model analysis utility: `scripts/analyse_model.py`

File focus: `scripts/analyse_model.py`

This script is for understanding a saved model checkpoint.

It does four useful things:

1. counts parameters
2. lists layers
3. benchmarks inference speed
4. saves the analysis as JSON

### Helper functions

`_count_parameters()` at `:19-22`

- counts total and trainable parameters

`_get_layer_info()` at `:25-47`

- walks through `named_modules()`
- records layer type and parameter counts
- includes extra info for linear or convolution layers

`_benchmark_inference()` at `:50-71`

- warms up the model
- runs multiple forward passes
- measures average inference time in milliseconds

### Main function

`analyse_model()` at `:74-135`

This builds one structured dictionary with:

- model class
- input shape
- total params
- trainable params
- non-trainable params
- layers
- inference latency
- file size
- text summary from `torchsummary`

### Checkpoint loader

`analyse_from_checkpoint()` at `:138-151`

This is beginner-friendly because it accepts either:

- a raw state dict
- or a checkpoint dict containing `model_state_dict`

That makes the utility more flexible.

## 12. ONNX export utility: `scripts/export_onnx.py`

File focus: `scripts/export_onnx.py`

This script converts a trained PyTorch model into ONNX format and compares the two formats.

### What ONNX is

ONNX is a portable model format. It is useful when you want to run a model outside standard PyTorch code.

### Main steps

1. load the checkpoint
2. rebuild `SimpleNN`
3. load saved weights
4. export to `.onnx`
5. compare file size
6. benchmark PyTorch inference
7. benchmark ONNX Runtime inference
8. save a JSON report

### Export details

At `scripts/export_onnx.py:73-82`, the export sets:

- `opset_version=17`
- named input/output tensors
- dynamic batch size axes

That makes the exported model more flexible for inference.

### Comparison metrics

The script reports:

- original `.pth` size
- exported `.onnx` size
- average PyTorch latency
- average ONNX latency
- size reduction percentage
- speedup multiplier

## 13. Broken or unfinished file: `scripts/train_best.py`

File focus: `scripts/train_best.py`

This file is incomplete.

Current content ends at:

```python
class SimpleNN
```

That is a syntax error and the file cannot run.

So right now this script should be treated as unfinished work, not a usable part of the platform.

## 14. Configuration files

### `configs/train_config.yaml`

This is the default training configuration.

It sets:

- model: `simple_nn`
- dataset: `mnist`
- learning rate: `0.001`
- batch size: `64`
- epochs: `10`
- optimizer: `adam`
- checkpoint dir: `models/`
- results dir: `results/`
- MLflow experiment name: `ai-training-platform`

Beginner takeaway:

This is the simplest place to edit if you want to change how default training works.

### `configs/config_lr_1.yaml`, `config_lr_2.yaml`, `config_lr_3.yaml`

These are the manual comparison configs:

- all use batch size `64`
- all use `5` epochs
- only learning rate changes

That is a good experiment design because it isolates one variable.

## 15. Existing outputs and what they tell us

### Model files

The `models/` folder contains many saved checkpoints, for example:

- `mnist_model.pth`
- `mnist_lr_0.001.pth`
- `exp_lr_0.001.pth`
- `best_model_lr_0.001.pth`

This suggests the project has gone through multiple naming conventions over time.

Important note:

Some current code writes filenames like:

- `models/mnist_best_{lr}.pth`
- `models/exp_lr_{lr}_best.pth`

But the existing files do not always match those patterns exactly.

That is not fatal, but it is a sign the repo has evolved without cleanup.

### Results files

Current state:

- `results/results.json` exists and contains manual experiment outcomes
- `results/best_config.json` exists but is `0` bytes
- `results/resukts.json` exists but is typo-named and `0` bytes

This means the reporting side is partially inconsistent.

## 16. Important beginner concepts used in this repo

### Epoch

One complete pass through the training data.

### Batch size

How many examples are processed at once before computing a gradient update.

### Learning rate

How large each optimization step is.

Too high:

- training can overshoot and become unstable

Too low:

- training can be slow

### Validation set

A held-out part of the training data used to estimate performance during training.

### Checkpoint

A saved snapshot of model weights and training information.

### MLflow

A tool that tracks:

- parameters
- metrics
- artifacts
- experiments

### Optuna

A tool that automatically searches for better hyperparameters.

### ONNX

A format for moving trained models to other runtimes or deployment environments.

## 17. Strengths of the codebase

This project is small enough for a beginner to understand, but still includes important real-world ideas:

- reusable training engine
- experiment tracking
- hyperparameter optimization
- API endpoints
- model inspection
- export to deployment-friendly format

That makes it a good learning project because it covers more than just "train one model once".

## 18. Weaknesses, rough edges, and technical debt

This section is important because beginners should learn to read code honestly.

### 1. There is code duplication

`SimpleNN` is defined in more than one place instead of being imported from one source of truth.

### 2. One script is broken

`scripts/train_best.py` is incomplete and unusable.

### 3. Some artifact files are empty

- `results/best_config.json`
- `results/resukts.json`

### 4. There is a typo-named file

`backend/_init_.py` looks accidental.

### 5. The API blocks while training

The `/train` and `/hpo` endpoints run long jobs directly in the request path.

### 6. There are unused imports

This usually means the file was refactored partway and not cleaned up fully.

### 7. Packaging is slightly messy

The project uses `sys.path.insert(...)` in several files, which is usually a workaround rather than a clean packaging setup.

### 8. The README is too small

`ReadME.md` only contains a short result summary, not setup instructions or architecture documentation.

### 9. No tests are present

There is no test suite in the repository, so changes are harder to verify automatically.

### 10. Runtime environment is not fully ready in the current virtual environment

While examining the repo, importing some training files through the local `.venv` failed because `mlflow` was missing there.

That means the checked-in code and the checked-in environment are not perfectly aligned right now.

## 19. Suggested reading order for a beginner

If you want to understand this repo step by step, read files in this order:

1. `configs/train_config.yaml`
2. `backend/ml/train_mnist.py`
3. `backend/ml/train_engine.py`
4. `backend/api/schemas.py`
5. `backend/api/main.py`
6. `scripts/run_experiments.py`
7. `scripts/hpo_search.py`
8. `scripts/analyse_model.py`
9. `scripts/export_onnx.py`

That order moves from simplest training flow to more advanced utilities.

## 20. If you wanted to improve this project next

Best next improvements would be:

1. finish or remove `scripts/train_best.py`
2. clean up filename conventions in `models/` and `results/`
3. move `SimpleNN` to one shared location only
4. add a proper README with setup and run steps
5. add tests for training utilities and API endpoints
6. move long-running training jobs into background workers
7. fix packaging so `sys.path.insert(...)` is not needed

## 21. Final beginner summary

This project is a compact ML backend for training and managing MNIST experiments.

The single most important idea is that `TrainEngine` is the reusable core, while everything else around it is an interface:

- `train_mnist.py` is the default local training entry point
- `run_experiments.py` is a manual comparison tool
- `hpo_search.py` is an automatic search tool
- `main.py` exposes these features as an API
- `analyse_model.py` and `export_onnx.py` are post-training utilities

So if you remember one sentence, remember this:

The project takes a PyTorch model, trains it on MNIST with tracked experiments, saves the best checkpoint, and then provides tools to inspect and export that checkpoint.
