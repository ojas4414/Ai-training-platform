# Free Deployment Guide

Date: March 19, 2026

This guide is only for zero-cost deployment prep. It does not require creating any paid service.

## Goal

Deploy:

- backend on Render Free
- frontend on Vercel Hobby

This is the safest free setup for the current project because:

- the backend already has a Dockerfile
- the frontend is a static Vite app
- the backend can run without Redis by falling back to in-memory cache

## Important Limitations

Before deploying, know these tradeoffs:

- Render Free web services can spin down when idle
- backend files like `mlruns/`, `results/`, and `models/` are ephemeral on a free web service
- Redis is not included in this free deployment path
- cache will still work, but only in memory while the backend instance is alive

That is okay for a portfolio demo. It is not a production setup.

If you want a strict zero-cost path:

- stay on free plans only
- do not upgrade the service type
- do not add optional paid add-ons
- monitor usage in the provider dashboard
- if a platform asks for billing details and you are unsure, stop and check before proceeding

## Backend: Render Free

The repo now includes:

- [render.yaml](c:/Users/Ojas/Desktop/ai-training-platform/render.yaml)
- [Dockerfile](c:/Users/Ojas/Desktop/ai-training-platform/Dockerfile)

Use this approach:

1. Go to Render and create a new Blueprint or Web Service from your GitHub repo.
2. If using the Blueprint flow, Render should detect `render.yaml`.
3. If using the manual Web Service flow, choose Docker as the runtime.
4. Make sure the deployed branch is `main`.

### Backend Environment Variables

Set these values in Render:

- `APP_HOST=0.0.0.0`
- `PORT=10000`
- `RELOAD=false`
- `MLFLOW_TRACKING_URI=mlruns`
- `CORS_ALLOW_ORIGINS=https://your-frontend-domain.vercel.app`
- `CORS_ALLOW_CREDENTIALS=false`

Do not set `REDIS_URL` for the free-first deployment. Leaving it unset keeps the backend on the built-in in-memory cache, which avoids needing another hosted service.

### Backend Health Check

Use:

- `/health`

### Backend Notes

- Render expects web services to listen on `0.0.0.0`
- Render commonly uses port `10000`, which is already handled in `render.yaml`
- if deployment succeeds, your backend URL will look like:
  `https://ai-training-platform-api.onrender.com`

## Frontend: Vercel Hobby

Use Vercel only for the `frontend/` app.

### Vercel Project Settings

When importing the repo:

- Framework preset: Vite
- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`

### Frontend Environment Variable

Set:

- `VITE_API_URL=https://your-render-backend.onrender.com`

The project already supports this through [frontend/.env.example](c:/Users/Ojas/Desktop/ai-training-platform/frontend/.env.example).

## First End-to-End Check

After both deployments exist:

1. Open the frontend URL
2. Check the header API status
3. Run `/health` on the backend directly
4. Try one training run
5. Try one HPO run with a small number of trials
6. Try one model prediction

## Recommended Free-Only Order

1. Finish making sure GitHub Actions is green
2. Deploy backend on Render Free
3. Deploy frontend on Vercel Hobby
4. Update backend `CORS_ALLOW_ORIGINS` to the real Vercel domain
5. Verify the live demo

## What To Avoid If You Want Zero Cost

Avoid these for now:

- paid Redis instances
- paid databases
- Vercel Pro
- Railway paid usage
- persistent disks unless you explicitly choose a paid plan

## Next Upgrade After Free Deployment

Once the free demo is working, the next best improvement is:

- real user-upload inference instead of sample-index-only prediction

After that:

- persistent artifact storage
- better model serving
- auth and per-user isolation
