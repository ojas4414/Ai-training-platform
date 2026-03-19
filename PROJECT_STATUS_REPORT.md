# Project Status Report

Date: March 19, 2026
Workspace: `c:\Users\Ojas\Desktop\ai-training-platform`

## Executive Summary

This project is no longer a starter skeleton. It is a working AI training platform with:

- PyTorch training and checkpointing
- MLflow experiment tracking
- Optuna HPO with parallel worker support
- FastAPI endpoints for training, HPO, experiments, model analysis, prediction, and export
- Redis-capable caching with in-memory fallback
- React dashboard with training, experiment, HPO, and model-lab flows
- ONNX export and backend-side INT8 quantisation
- tests plus GitHub Actions CI
- frontend bundle cleanup with code-splitting

As of March 19, 2026, the repo is in a good "strong student / early portfolio project" state, but it is not fully finished as a deployable, multi-user ML platform yet.

## Verified Current State

These checks were re-run before writing this report:

- backend tests: `21 passed`
- frontend lint: passing
- frontend production build: passing

Repo delivery state:

- current branch: `main`
- git repo exists
- GitHub remote is configured
- repo has been pushed to GitHub
- GitHub Actions CI is active on GitHub and has already passed on a recent commit

Environment limitation noted during verification:

- Docker is not installed on this machine right now, so `docker compose` has not been validated locally in this environment

## What Is Already Done

### 1. Core ML training

- reusable training engine exists
- config-driven training exists
- checkpoints are saved
- MLflow logging is wired into training

### 2. Experimentation and HPO

- manual experiment flow exists
- Optuna search exists
- HPO now supports parallel workers with `n_jobs`
- HPO results are persisted to JSON

### 3. Backend API

- `/health`
- `/cache/stats`
- `/train`
- `/hpo`
- `/experiments`
- `/experiments/mlflow`
- `/models`
- `/predict/{checkpoint_filename}`
- `/analyse/{checkpoint_filename}`
- `/export/{checkpoint_filename}`

### 4. Caching

- cache abstraction exists
- in-memory cache works
- Redis-backed cache support exists
- cache TTL logic is fixed and tested

### 5. Frontend dashboard

- experiment dashboard exists
- training screen exists
- HPO screen exists
- model lab exists
- sample prediction UI exists
- frontend bundle has been split so initial load is lighter

### 6. Model optimisation work

- ONNX export exists
- ONNX benchmarking exists
- backend-side INT8 dynamic quantisation exists

### 7. Quality and tooling

- Python tests exist
- CI workflow exists
- frontend lint/build pass
- Dockerfile, compose file, env templates, and dockerignore exist

## What Is Still Left To Do

This is the important part: the remaining work is no longer "build the whole product." It is now mostly delivery, hardening, and production-level features.

### A. Immediate delivery blockers

These should be done first because they affect live delivery.

1. Validate Docker for real
- install Docker Desktop or Docker Engine
- run `docker compose up --build`
- verify backend + Redis actually start
- verify the app works against the Redis-backed cache, not just the memory fallback

### B. Deployment work

This is the next biggest gap between the current repo and a job-ready portfolio project.

1. Deploy the backend
- Railway, Render, or another simple platform
- set env vars properly
- verify MLflow artifact paths behave correctly in deployed storage

2. Deploy the frontend
- Vercel is the easiest option
- point `VITE_API_URL` to the deployed backend
- verify CORS with the deployed frontend domain

3. Produce a real live demo URL
- this is still missing and is one of the highest-value interview assets

4. Add deployment notes and screenshots
- not in the README only, but also as proof for recruiters or interviewers

### C. Production serving is only partially done

A serving path exists, but it is still narrow.

What is already there:

- a real `/predict/{checkpoint}` endpoint
- the frontend can call it
- the system can load a saved checkpoint and return prediction data

What is still missing:

1. General inference input support
- right now inference is tied to a sampled MNIST example
- there is no image upload or raw tensor/image payload API for users

2. A fuller serving layer
- no BentoML service yet
- no dedicated inference packaging or model registry flow

3. Better deployment-oriented serving
- no versioned served models
- no promoted "best model" endpoint
- no API auth around inference

### D. Multi-user and security features are still missing

These were in your original roadmap and are still not built.

1. Authentication
- no Google OAuth2 flow
- no authlib integration
- no user accounts

2. Per-user experiment isolation
- experiments are not scoped to users
- there is no private data separation yet

3. Rate limiting and abuse protection
- no "max 5 concurrent experiments per user" control
- no request throttling middleware

4. Training sandboxing/resource control
- Docker exists, but jobs are not being launched as isolated per-training containers with CPU/memory limits

### E. Data/versioning and reproducibility work

Still missing from the roadmap:

1. DVC setup
- no DVC init
- no dataset remote
- no dataset lineage flow

2. Reproducible dataset version switching
- there is no documented or automated way to retrain against named dataset versions

### F. Frontend/product polish still left

The UI is much better now, but a few real gaps remain.

1. Quantisation is not surfaced well in the dashboard
- backend export already computes INT8 metrics
- frontend types know about quantised output
- the current model lab does not fully present the quantised comparison to the user

2. Model upload is still limited
- the original plan talked about accepting arbitrary `.pt` / `.pth` files
- current flows work with saved checkpoints in the local `models/` directory
- there is not yet a real upload endpoint/UI for an external checkpoint file

3. Better status/feedback UX
- no persistent notifications
- no progress feedback for long-running HPO beyond local waiting text
- no job queue view

### G. CI/CD is only half-finished

CI exists. CD does not.

Already done:

- test workflow on push / pull request
- Python + Node setup
- backend tests
- frontend lint/build

Still left:

1. automatic deployment after passing CI
- not present yet

2. secrets and environment management in GitHub
- not configured here yet

3. deployment badges and live links
- still missing

### H. Portfolio and interview assets are still left

These matter a lot for getting interviews.

1. Demo video
- not present yet

2. Architecture diagram
- not present yet

3. Resume-ready project summary
- not present as a dedicated artifact yet

4. LinkedIn / application package
- outside the repo, but still part of the sprint plan

## Recommended Next Order

If the goal is job readiness, this is the order I recommend now:

1. Install Docker and verify `docker compose`
2. Deploy backend
3. Deploy frontend
4. Add one real public demo URL and screenshot proof
5. Upgrade prediction from "sample index" to "real user input"
6. Surface INT8 quantisation results in the frontend
7. Add auto-deploy in GitHub Actions
8. Add DVC
9. Add auth and per-user isolation

## Suggested Definition Of "Good Enough To Apply"

You are in "apply soon" territory once these are true:

- code is pushed to GitHub
- CI is green on GitHub, not just locally
- backend and frontend are both live
- the demo URL works
- you can explain training, HPO, caching, prediction, ONNX, and Redis clearly
- you have a short demo video

## Suggested Definition Of "Strong Final Version"

You are in "very strong portfolio piece" territory once these are true:

- deployed full stack with working live URL
- real inference input from users, not just sampled MNIST index
- DVC-backed reproducibility
- auth and per-user isolation
- CI plus auto-deploy
- quantisation visible in the UI
- demo video plus architecture diagram plus polished GitHub presentation

## Bottom Line

The hardest middle part is already done.

What is left is mostly:

- shipping
- deployment
- hardening
- multi-user/security features
- portfolio packaging

This is a good place to be. You are no longer proving that you can write ML code. The remaining work is about proving that you can ship it like an engineer.
