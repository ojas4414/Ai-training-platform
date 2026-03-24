import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

import torch
from backend.api.main import load_prediction_sample, process_uploaded_image
from backend.api.schemas import PredictionRequest

def debug():
    print("Testing load_prediction_sample...")
    try:
        image_batch, true_label, image_pixels = load_prediction_sample("test", 0)
        print(f"Success! Label: {true_label}, Batch shape: {image_batch.shape}")
    except Exception as e:
        print(f"Failed load_prediction_sample: {e}")

    print("\nTesting process_uploaded_image...")
    try:
        # Dummy base64 for a 1x1 black pixel
        dummy_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        image_batch, image_pixels = process_uploaded_image(dummy_b64)
        print(f"Success! Batch shape: {image_batch.shape}")
    except Exception as e:
        print(f"Failed process_uploaded_image: {e}")

if __name__ == "__main__":
    debug()
