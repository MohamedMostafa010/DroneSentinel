from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..models import TrainingConfig
from ..workers.training_worker import TrainingWorker
import os, csv, psutil

try:
    import pynvml
    pynvml.nvmlInit()
    _nvml_ok = True
except Exception:
    _nvml_ok = False

router = APIRouter(prefix="/training", tags=["training"])

_worker: TrainingWorker | None = None
_log: list[str] = []


def _push_log(msg: str):
    _log.append(msg)
    if len(_log) > 500:
        _log.pop(0)


def _validate_dataset(data_yaml_path: str):
    """
    Validate that the dataset folder contains the expected YOLO structure.
    Raises HTTPException with a descriptive message if anything is missing.
    """
    if not os.path.isfile(data_yaml_path):
        raise HTTPException(status_code=400, detail=f"data.yaml not found: {data_yaml_path}")

    dataset_dir = os.path.dirname(data_yaml_path)
    errors = []

    for split in ("train", "valid", "val"):
        img_dir = os.path.join(dataset_dir, split, "images")
        lbl_dir = os.path.join(dataset_dir, split, "labels")
        if os.path.isdir(img_dir):
            n_imgs = len([f for f in os.listdir(img_dir)
                          if f.lower().endswith((".jpg", ".jpeg", ".png", ".bmp"))])
            n_lbls = len([f for f in os.listdir(lbl_dir)
                          if f.lower().endswith(".txt")]) if os.path.isdir(lbl_dir) else 0
            if n_imgs == 0:
                errors.append(f"{split}/images is empty")
            if not os.path.isdir(lbl_dir):
                errors.append(f"{split}/labels directory missing")
            elif n_lbls == 0:
                errors.append(f"{split}/labels is empty")
            break  # only check whichever split exists

    if errors:
        raise HTTPException(
            status_code=400,
            detail="Dataset validation failed: " + "; ".join(errors),
        )


@router.post("/start")
def start_training(cfg: TrainingConfig):
    global _worker, _log
    if _worker and _worker.is_running():
        raise HTTPException(status_code=400, detail="Training already running")

    _validate_dataset(cfg.data_yaml)

    _log.clear()
    _worker = TrainingWorker(
        config=cfg.dict(),
        on_progress=_push_log,
        on_finished=lambda ok, msg: _push_log(f"{'✓' if ok else '✗'} {msg}"),
    )
    _worker.start()
    return {"status": "started"}


class ResumeConfig(BaseModel):
    last_pt: str  # path to last.pt


@router.post("/resume")
def resume_training(cfg: ResumeConfig):
    global _worker, _log
    if _worker and _worker.is_running():
        raise HTTPException(status_code=400, detail="Training already running")

    _log.clear()
    _worker = TrainingWorker(
        config={"resume": True, "model": cfg.last_pt},
        on_progress=_push_log,
        on_finished=lambda ok, msg: _push_log(("✓" if ok else "✗") + " " + msg),
    )
    _worker.start()
    return {"status": "resumed"}


@router.post("/stop")
def stop_training():
    global _worker
    if _worker:
        _worker.stop()
        return {"status": "stopped"}
    return {"status": "not running"}


@router.get("/status")
def get_status():
    running = _worker is not None and _worker.is_running()
    return {"running": running, "log": _log[-100:]}


def _parse_results_csv(csv_path: str):
    """Parse YOLO results.csv and return last row + best mAP50 row as dicts."""
    if not os.path.exists(csv_path):
        return None, None
    rows = []
    with open(csv_path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append({k.strip(): v.strip() for k, v in row.items()})
    if not rows:
        return None, None

    def safe(d, *keys):
        for k in keys:
            if k in d:
                try: return round(float(d[k]), 4)
                except: pass
        return None

    def extract(row):
        return {
            "epoch":       safe(row, "epoch"),
            "box_loss":    safe(row, "train/box_loss"),
            "cls_loss":    safe(row, "train/cls_loss"),
            "dfl_loss":    safe(row, "train/dfl_loss"),
            "precision":   safe(row, "metrics/precision(B)"),
            "recall":      safe(row, "metrics/recall(B)"),
            "mAP50":       safe(row, "metrics/mAP50(B)"),
            "mAP50_95":    safe(row, "metrics/mAP50-95(B)"),
            "val_box_loss":safe(row, "val/box_loss"),
        }

    last = extract(rows[-1])
    best_row = max(rows, key=lambda r: float(r.get("metrics/mAP50(B)", 0) or 0))
    best = extract(best_row)
    return last, best


def _get_hw_stats():
    cpu_pct  = psutil.cpu_percent(interval=None)
    cpu_temp = None
    try:
        temps = psutil.sensors_temperatures()
        for name, entries in temps.items():
            if entries:
                cpu_temp = round(entries[0].current, 1)
                break
    except Exception:
        pass

    gpu_util = gpu_mem_used = gpu_mem_total = gpu_temp = None
    if _nvml_ok:
        try:
            handle = pynvml.nvmlDeviceGetHandleByIndex(0)
            info   = pynvml.nvmlDeviceGetUtilizationRates(handle)
            mem    = pynvml.nvmlDeviceGetMemoryInfo(handle)
            temp   = pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU)
            gpu_util      = info.gpu
            gpu_mem_used  = round(mem.used  / 1024**2)
            gpu_mem_total = round(mem.total / 1024**2)
            gpu_temp      = temp
        except Exception:
            pass

    return {
        "cpu_pct":       cpu_pct,
        "cpu_temp":      cpu_temp,
        "gpu_util":      gpu_util,
        "gpu_mem_used":  gpu_mem_used,
        "gpu_mem_total": gpu_mem_total,
        "gpu_temp":      gpu_temp,
    }


class EvalConfig(BaseModel):
    data_yaml: str
    model_pt:  str          # path to best.pt or last.pt
    split:     str = "test" # test | val | train
    imgsz:     int = 640
    device:    str = "0"
    save_json: bool = False
    save_txt:  bool = False


_eval_worker: TrainingWorker | None = None
_eval_log: list[str] = []


def _push_eval_log(msg: str):
    _eval_log.append(msg)
    if len(_eval_log) > 500:
        _eval_log.pop(0)


@router.post("/evaluate/start")
def start_evaluate(cfg: EvalConfig):
    global _eval_worker, _eval_log
    if _eval_worker and _eval_worker.is_running():
        raise HTTPException(status_code=400, detail="Evaluation already running")

    cmd_parts = [
        "yolo", "val",
        f'data="{cfg.data_yaml}"',
        f'model="{cfg.model_pt}"',
        f"split={cfg.split}",
        f"imgsz={cfg.imgsz}",
        f"device={cfg.device}",
    ]
    if cfg.save_json: cmd_parts.append("save_json=True")
    if cfg.save_txt:  cmd_parts.append("save_txt=True")

    _eval_log.clear()
    _eval_worker = TrainingWorker(
        config={"_raw_cmd": " ".join(cmd_parts)},
        on_progress=_push_eval_log,
        on_finished=lambda ok, msg: _push_eval_log(("✓" if ok else "✗") + " " + msg),
    )
    _eval_worker.start()
    return {"status": "started"}


@router.post("/evaluate/stop")
def stop_evaluate():
    global _eval_worker
    if _eval_worker:
        _eval_worker.stop()
    return {"status": "stopped"}


@router.get("/evaluate/status")
def get_evaluate_status():
    running = _eval_worker is not None and _eval_worker.is_running()
    return {"running": running, "log": _eval_log[-200:]}


@router.get("/load-config")
def load_config(args_yaml: str):
    """Load a training args.yaml file and return it as a config dict."""
    import yaml
    if not os.path.exists(args_yaml):
        raise HTTPException(status_code=404, detail=f"File not found: {args_yaml}")
    try:
        with open(args_yaml, "r") as f:
            args = yaml.safe_load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")
    return {"config": args or {}}


@router.get("/metrics")
def get_metrics(run_dir: str = ""):
    """
    Returns last.pt metrics, best.pt metrics, and live GPU/CPU stats.
    run_dir: full path to the training run folder (e.g. C:/Users/.../dronesentinel_trainXXX3)
    """
    last_metrics, best_metrics = None, None
    if run_dir:
        csv_path = os.path.join(run_dir, "results.csv")
        last_metrics, best_metrics = _parse_results_csv(csv_path)

    return {
        "last": last_metrics,
        "best": best_metrics,
        "hw":   _get_hw_stats(),
    }
