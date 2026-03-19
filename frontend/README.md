# AI Training Platform Frontend

React + TypeScript + Vite dashboard for the AI Training Platform.

## Features

- experiment overview
- single-run training UI
- Optuna HPO launch and results view
- model analysis and ONNX export view

## Run locally

```powershell
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

## Environment

Create a `.env` file from `.env.example` if you want to point the frontend at a deployed backend:

```text
VITE_API_URL=https://your-backend.onrender.com
```

If `VITE_API_URL` is not set, the frontend uses `http://localhost:8000`.

## Main files

- `src/App.tsx` - top-level shell and tab navigation
- `src/api.ts` - Axios API client
- `src/components/ExperimentsTab.tsx` - experiment overview
- `src/components/TrainTab.tsx` - training form and charts
- `src/components/HPOTab.tsx` - Optuna search UI
- `src/components/ModelsTab.tsx` - model analysis and ONNX export
