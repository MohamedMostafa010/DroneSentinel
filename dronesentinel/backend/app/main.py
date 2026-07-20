import os
import sys

# Prepend PyTorch's bundled CUDA DLLs to PATH so they load before system
# CUDA 12.8 DLLs — prevents cufftw64_11.dll version conflict with OpenCV 4.13
_torch_lib = os.path.join(
    os.path.dirname(sys.executable), "Lib", "site-packages", "torch", "lib"
)
if os.path.isdir(_torch_lib):
    os.environ["PATH"] = _torch_lib + os.pathsep + os.environ.get("PATH", "")

# Must be set before cv2/ffmpeg loads anywhere in the process
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = (
    "rtsp_transport;tcp|fflags;nobuffer|flags;low_delay|thread_queue_size;512"
)

import warnings
warnings.filterwarnings("ignore", category=FutureWarning, module="torch")

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from .limiter import limiter
from .database import init_db
from .config import ENCRYPTION_KEY_FILE, DB_FILE
from .routes import detection, training, analytics, admin, troubleshoot

app = FastAPI(title="DroneSentinel API", version="1.0.0")

# ── Rate limiter ──────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(detection.router)
app.include_router(training.router)
app.include_router(analytics.router)
app.include_router(admin.router)
app.include_router(troubleshoot.router)

# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
def startup():
    init_db()

# ── Root ──────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "DroneSentinel API running"}

# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    checks: dict = {} # Same as "checks = {}"

    # Encryption key accessible
    checks["encryption_key"] = os.path.exists(ENCRYPTION_KEY_FILE)

    # Database accessible
    checks["database"] = os.path.exists(DB_FILE)

    # CUDA / GPU
    try:
        import torch
        checks["cuda_available"] = torch.cuda.is_available()
        checks["gpu_name"] = torch.cuda.get_device_name(0) if torch.cuda.is_available() else None
        # Output example:
            # "cuda_available": true,
            # "gpu_name": "NVIDIA RTX 3060"
            # If no GPU:
            # "cuda_available": false,
            # "gpu_name": null
    except Exception:
        checks["cuda_available"] = False
        checks["gpu_name"] = None

    # YOLO importable
    try:
        from ultralytics import YOLO  # noqa: F401
        checks["yolo_importable"] = True
    except Exception:
        checks["yolo_importable"] = False

    all_ok = all(
        v is True or (isinstance(v, bool) and v)
        for k, v in checks.items()
        if k not in ("gpu_name",)  # gpu_name is a string, not a bool
    )
    return {"status": "ok" if all_ok else "degraded", "checks": checks}
