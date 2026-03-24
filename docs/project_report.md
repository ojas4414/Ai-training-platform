# AI Training Platform: Project Report

The **AI Training Platform** is a state-of-the-art, cinematic web application designed for the interactive training, management, and evaluation of machine learning models. It combines a high-fidelity 3D environment with a functional "Mission Control" dashboard.

## Core Functionality

- **Interactive 3D Hub**: A cinematic experience powered by Three.js where users navigate through different "Chapters" of the AI development lifecycle.
- **Mission Control Dashboard**: A glassmorphic overlay providing access to:
    - **Experiments**: Real-time tracking of training runs using MLflow.
    - **Training**: Direct control over model training parameters and data.
    - **HPO (Hyperparameter Optimization)**: Automated tuning of model architectures and training scripts via Optuna.
    - **Model Management**: Exporting models to ONNX and applying INT8 quantization for edge deployment.
- **Real-time Inference**: Capability to upload custom images for immediate model prediction, featuring automated preprocessing (e.g., MNIST-compatible inversion).

## Tech Stack Detail

### Frontend
- **Framework**: [React 19](https://react.dev/) with [TypeScript](https://www.typescriptlang.org/).
- **Build Tool**: [Vite 8](https://vite.dev/) for ultra-fast development and optimized production builds.
- **3D Graphics**:
    - [Three.js](https://threejs.org/) for the core 3D engine.
    - [@react-three/fiber](https://docs.pmnd.rs/react-three-fiber) & [@react-three/drei](https://github.com/pmndrs/drei) for declarative 3D modeling in React.
    - [@react-three/postprocessing](https://github.com/pmndrs/react-three-postprocessing) for advanced visual effects like bloom and lens flares.
- **Animations**: [GSAP](https://gsap.com/) and [Framer Motion](https://www.framer.com/motion/) for smooth transitions and interactive micro-animations.
- **Visualizations**: [Recharts](https://recharts.org/) for high-performance training metric charts.
- **UX/Design**: [Vanilla CSS](https://developer.mozilla.org/en-US/docs/Web/CSS) with modern features (backdrop filters, glassmorphism) and [Lenis](https://github.com/darkroomengineering/lenis) for smooth scroll synchronization with 3D camera waypoints.

### Backend
- **Language**: [Python 3.10+](https://www.python.org/).
- **API Framework**: [FastAPI](https://fastapi.tiangolo.com/) for high-performance, asynchronous endpoints.
- **ML Engine**:
    - [PyTorch](https://pytorch.org/) for neural network training and definition.
    - [Torchvision](https://pytorch.org/vision/) for image processing.
- **Experiment Management**: [MLflow](https://mlflow.org/) for logging parameters, metrics, and artifacts.
- **Optimization**: [Optuna](https://optuna.org/) for efficient hyperparameter search.
- **Model Interop**: [ONNX](https://onnx.ai/) and [ONNX Runtime](https://onnxruntime.ai/) for framework-agnostic deployment and quantization.
- **Caching**: [Redis](https://redis.io/) for high-speed temporary storage and result caching.

## Architecture

The project follows a **Decoupled Architecture**:
1. **Frontend**: A SPA (Single Page Application) that handles all UI/UX and 3D rendering. It communicates with the backend via RESTful APIs.
2. **Backend**: A stateless FastAPI server that manages the ML lifecycle, interacts with MLflow/Optuna, and performs heavy computation (training/inference).
3. **Data Layer**: Uses a combination of local storage (for models/logs) and Redis/MLflow for stateful experiment data.
