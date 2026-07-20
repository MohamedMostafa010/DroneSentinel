"""Troubleshooting & Benchmark API routes."""
import os, sys, time, subprocess, asyncio
from threading import Thread, Event
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/troubleshoot", tags=["troubleshoot"])

# ── Shared state for benchmark progress ──
_bench_state = {
    "running": False,
    "stage": "",
    "progress": 0,
    "results": None,
    "error": None,
}
_stop = Event()


# ── System check (no camera needed) ──
@router.get("/system-check")
def system_check():
    """Quick non-blocking hardware/software check."""
    info = {
        "python": sys.version.split()[0],
        "opencv": None, "opencv_cuda": False, "cuda_devices": 0,
        "nvdec": False, "torch": None, "torch_cuda": False,
        "gpu_name": None, "cuda_version": None,
    }
    try:
        import cv2
        info["opencv"] = cv2.__version__
        try:
            info["cuda_devices"] = cv2.cuda.getCudaEnabledDeviceCount()
            info["opencv_cuda"] = info["cuda_devices"] > 0
        except Exception:
            pass
        info["nvdec"] = hasattr(cv2, "cudacodec")
        # Check build info for NVCUVID
        bi = cv2.getBuildInformation()
        info["nvcuvid_in_build"] = "NVCUVID" in bi
    except ImportError:
        pass
    try:
        import torch
        info["torch"] = torch.__version__
        info["torch_cuda"] = torch.cuda.is_available()
        if info["torch_cuda"]:
            info["gpu_name"] = torch.cuda.get_device_name(0)
            info["cuda_version"] = torch.version.cuda
    except ImportError:
        pass
    return info


class PingRequest(BaseModel):
    ip: str

@router.post("/ping")
def ping_camera(req: PingRequest):
    """Ping a camera IP and return RTT stats."""
    try:
        r = subprocess.run(
            ["ping", "-n", "5", req.ip],
            capture_output=True, text=True, timeout=15
        )
        lines = r.stdout.strip().split("\n")
        times = []
        for line in lines:
            if "time=" in line or "time<" in line:
                try:
                    t = line.split("time")[1].split("ms")[0]
                    t = t.replace("=","").replace("<","").strip()
                    times.append(float(t))
                except (ValueError, IndexError):
                    pass
        import numpy as np
        summary_line = ""
        for line in lines:
            if "Minimum" in line or "Average" in line:
                summary_line = line.strip()
        if times:
            arr = np.array(times)
            return {
                "ok": True, "ip": req.ip,
                "avg": round(float(arr.mean()), 1),
                "min": round(float(arr.min()), 1),
                "max": round(float(arr.max()), 1),
                "p95": round(float(np.percentile(arr, 95)), 1),
                "summary": summary_line,
                "count": len(times),
            }
        return {"ok": False, "ip": req.ip, "error": "No replies", "summary": summary_line}
    except subprocess.TimeoutExpired:
        return {"ok": False, "ip": req.ip, "error": "Ping timed out"}
    except Exception as e:
        return {"ok": False, "ip": req.ip, "error": str(e)}


class BenchRequest(BaseModel):
    rtsp_url: str
    model_path: str = ""
    num_frames: int = 60

def _run_benchmark(rtsp_url: str, model_path: str, num_frames: int):
    """Background worker — populates _bench_state."""
    import cv2, numpy as np
    WARMUP = 5
    results = {}
    try:
        # --- Stage 1: RTSP connect ---
        _bench_state["stage"] = "Connecting to RTSP stream..."
        _bench_state["progress"] = 5
        t0 = time.perf_counter()
        params = cv2.cudacodec.VideoReaderInitParams()
        params.allowFrameDrop = True
        use_gpu = False
        reader = None
        cap = None
        try:
            reader = cv2.cudacodec.createVideoReader(rtsp_url, params=params)
            ret, _ = reader.nextFrame()
            use_gpu = ret
            if not ret:
                del reader; reader = None
        except Exception:
            reader = None
        if not use_gpu:
            cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            if not cap.isOpened():
                _bench_state["error"] = "Cannot open RTSP stream"
                _bench_state["running"] = False
                return

        connect_ms = (time.perf_counter() - t0) * 1000
        results["connect_ms"] = round(connect_ms, 0)
        results["decoder"] = "NVDEC (GPU)" if use_gpu else "FFmpeg (CPU)"

        if _stop.is_set(): return

        # --- Stage 2: Decode breakdown ---
        _bench_state["stage"] = "Benchmarking decode pipeline..."
        _bench_state["progress"] = 15
        t_decode, t_download, t_convert, t_resize = [], [], [], []

        for i in range(WARMUP + num_frames):
            if _stop.is_set(): return
            if use_gpu:
                t0 = time.perf_counter()
                ret, gf = reader.nextFrame()
                dt_dec = (time.perf_counter() - t0) * 1000
                if not ret or gf is None: continue
                t0 = time.perf_counter()
                frame = gf.download()
                dt_dl = (time.perf_counter() - t0) * 1000
            else:
                t0 = time.perf_counter()
                ret, frame = cap.read()
                dt_dec = (time.perf_counter() - t0) * 1000
                dt_dl = 0.0
                if not ret or frame is None: continue

            t0 = time.perf_counter()
            if len(frame.shape) == 3 and frame.shape[2] == 4:
                frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)
            dt_cvt = (time.perf_counter() - t0) * 1000

            t0 = time.perf_counter()
            small = cv2.resize(frame, (640, 640))
            dt_rsz = (time.perf_counter() - t0) * 1000

            if i >= WARMUP:
                t_decode.append(dt_dec)
                t_download.append(dt_dl)
                t_convert.append(dt_cvt)
                t_resize.append(dt_rsz)

            pct = 15 + int(50 * (i / (WARMUP + num_frames)))
            _bench_state["progress"] = min(pct, 65)

        def s(arr):
            a = np.array(arr) if arr else np.array([0])
            return {"avg": round(float(a.mean()),2), "med": round(float(np.median(a)),2),
                    "p95": round(float(np.percentile(a,95)),2),
                    "min": round(float(a.min()),2), "max": round(float(a.max()),2)}

        results["decode"] = s(t_decode)
        results["download"] = s(t_download)
        results["convert"] = s(t_convert)
        results["resize"] = s(t_resize)
        total_read = [a+b+c+d for a,b,c,d in zip(t_decode, t_download, t_convert, t_resize)]
        results["total_read"] = s(total_read)

        if _stop.is_set(): return

        # --- Stage 3: YOLO inference (optional) ---
        if model_path and os.path.isfile(model_path):
            _bench_state["stage"] = "Loading YOLO model..."
            _bench_state["progress"] = 70
            from ultralytics import YOLO
            model = YOLO(model_path, task="detect")
            dummy = np.random.randint(0,255,(640,640,3), dtype=np.uint8)
            for _ in range(WARMUP):
                model(dummy, conf=0.65, verbose=False)

            _bench_state["stage"] = "Benchmarking inference..."
            _bench_state["progress"] = 75
            t_infer = []
            # Re-open stream for inference test
            if use_gpu:
                del reader
                reader = cv2.cudacodec.createVideoReader(rtsp_url, params=params)
            for i in range(min(num_frames, 60)):
                if _stop.is_set(): return
                if use_gpu:
                    ret, gf = reader.nextFrame()
                    if not ret: continue
                    frame = gf.download()
                else:
                    ret, frame = cap.read()
                    if not ret: continue
                if len(frame.shape)==3 and frame.shape[2]==4:
                    frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)
                small = cv2.resize(frame, (640,640))
                t0 = time.perf_counter()
                model(small, conf=0.65, verbose=False)
                t_infer.append((time.perf_counter()-t0)*1000)
                _bench_state["progress"] = 75 + int(20*(i/min(num_frames,60)))

            results["inference"] = s(t_infer)
            results["inference_fps"] = round(1000/np.mean(t_infer),1) if t_infer else 0
        else:
            results["inference"] = None
            results["inference_fps"] = None

        # Cleanup
        if reader: del reader
        if cap: cap.release()

        # --- Bottleneck analysis ---
        components = {
            "GPU decode": results["decode"]["avg"],
            "GPU→CPU download": results["download"]["avg"],
            "Color convert": results["convert"]["avg"],
            "Resize": results["resize"]["avg"],
        }
        if results.get("inference"):
            components["YOLO inference"] = results["inference"]["avg"]
        bottleneck = max(components, key=components.get)
        results["bottleneck"] = bottleneck
        results["bottleneck_ms"] = round(components[bottleneck], 1)

        tips = {
            "GPU decode": "High decode time usually means the GPU is waiting for network data. Try Ethernet instead of WiFi.",
            "GPU→CPU download": "GPU→CPU transfer is high. Frame data is large — consider lower resolution.",
            "Color convert": "Color conversion overhead is unusually high. This is rare.",
            "Resize": "Resize overhead is unusually high. This is rare.",
            "YOLO inference": "Inference is the bottleneck. Try a smaller model (nano/small), or increase YOLO_EVERY skip.",
        }
        results["tip"] = tips.get(bottleneck, "")
        results["num_frames"] = num_frames

        _bench_state["results"] = results
        _bench_state["progress"] = 100
        _bench_state["stage"] = "Complete"
    except Exception as e:
        _bench_state["error"] = str(e)
    finally:
        _bench_state["running"] = False


@router.post("/benchmark/start")
def start_benchmark(req: BenchRequest):
    if _bench_state["running"]:
        return {"ok": False, "error": "Benchmark already running"}
    _stop.clear()
    _bench_state.update(running=True, stage="Starting...", progress=0, results=None, error=None)
    Thread(target=_run_benchmark, args=(req.rtsp_url, req.model_path, req.num_frames), daemon=True).start()
    return {"ok": True}

@router.post("/benchmark/stop")
def stop_benchmark():
    _stop.set()
    return {"ok": True}

@router.get("/benchmark/status")
def benchmark_status():
    return {
        "running": _bench_state["running"],
        "stage": _bench_state["stage"],
        "progress": _bench_state["progress"],
        "results": _bench_state["results"],
        "error": _bench_state["error"],
    }
