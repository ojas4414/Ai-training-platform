# syntax=docker/dockerfile:1
FROM python:3.10-slim AS base

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY backend/ ./backend/
COPY scripts/ ./scripts/
COPY configs/ ./configs/

# Ensure results + models dirs exist
RUN mkdir -p results models data

# Expose port
EXPOSE 8000

# Start FastAPI
CMD ["python", "-m", "backend.api.main"]
