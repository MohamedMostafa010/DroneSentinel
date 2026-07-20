import queue
import threading
import time

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

import base64
import cv2

from ..models import DetectionConfig, SwitchSourceRequest, SetAnnotateRequest, SetEmailRequest, TestSMTPRequest
from ..workers.detection_worker import DetectionWorker
from ..services.analytics_service import analytics_service
from ..settings import settings_manager
from ..utils.video_stream import mjpeg_generator

router = APIRouter(prefix="/detection", tags=["detection"])

_worker: DetectionWorker | None = None
_frame_queue: queue.Queue = queue.Queue(maxsize=4)
_log: list[str] = []
_alerts: list[str] = []
_last_config: dict = {}
_watchdog_thread: threading.Thread | None = None
_watchdog_stop = threading.Event()


def _push_log(msg: str):
    _log.append(msg)
    if len(_log) > 200:
        _log.pop(0)


def _push_alert(msg: str):
    _alerts.append(msg)
    if len(_alerts) > 200:
        _alerts.pop(0)


def _build_worker(config: dict) -> DetectionWorker:
    global _frame_queue
    _frame_queue = queue.Queue(maxsize=2)
    return DetectionWorker(
        config=config,
        on_progress=_push_log,
        on_alert=_push_alert,
        on_metrics=lambda m: analytics_service.update(m),
        on_finished=lambda ok, msg: _push_log(f"{'✓' if ok else '✗'} {msg}"),
        frame_queue=_frame_queue,
    )


def _watchdog_loop():
    """
    Background thread that monitors the detection worker.
    If auto_restart=True and the worker dies unexpectedly, restarts it.
    """
    global _worker
    while not _watchdog_stop.is_set():
        time.sleep(5)
        if (
            _last_config.get("auto_restart")
            and _worker is not None
            and not _worker.is_running()
        ):
            _push_log("⚠ Worker stopped unexpectedly — auto-restarting...")
            _worker = _build_worker(_last_config)
            _worker.start()
            _push_log("↺ Worker restarted by watchdog")


@router.post("/start")
def start_detection(cfg: DetectionConfig):
    global _worker, _log, _alerts, _last_config, _watchdog_thread, _watchdog_stop
    if _worker and _worker.is_running():
        raise HTTPException(status_code=400, detail="Detection already running")

    _log.clear()
    _alerts.clear()
    _last_config = cfg.dict()

    settings_manager.update(_last_config)

    _worker = _build_worker(_last_config)
    _worker.start()

    # Start watchdog if not already running
    if _watchdog_thread is None or not _watchdog_thread.is_alive():
        _watchdog_stop.clear()
        _watchdog_thread = threading.Thread(
            target=_watchdog_loop, daemon=True, name="DetectionWatchdog"
        )
        _watchdog_thread.start()

    return {"status": "started"}


@router.post("/stop")
def stop_detection():
    global _worker, _watchdog_stop
    # Stop watchdog first so it doesn't restart the worker we're about to kill
    _watchdog_stop.set()
    if _worker:
        _worker.stop()
        try:
            _frame_queue.put_nowait(None)
        except queue.Full:
            pass
        return {"status": "stopped"}
    return {"status": "not running"}


@router.post("/switch-source")
def switch_source(body: SwitchSourceRequest):
    if not _worker or not _worker.is_running():
        raise HTTPException(status_code=400, detail="Detection is not running")
    _worker.switch_source(body.source)
    return {"status": "switching", "source": body.source}


@router.get("/preview")
def preview_source(source: str):
    """Grab one test frame from a source and return it as a base64 JPEG."""
    src = source.strip()
    try:
        cap = cv2.VideoCapture(int(src)) if src.isdigit() else cv2.VideoCapture(src)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid source")

    if not cap.isOpened():
        cap.release()
        raise HTTPException(status_code=400, detail=f"Cannot open source: {source}")

    frame = None
    for _ in range(15):
        ret, f = cap.read()
        if ret and f is not None:
            frame = f
            break
    cap.release()

    if frame is None:
        raise HTTPException(status_code=400, detail="Failed to grab frame from source")

    h, w = frame.shape[:2]
    if w > 640:
        scale = 640 / w
        frame = cv2.resize(frame, (640, int(h * scale)))

    _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
    b64 = base64.b64encode(buf.tobytes()).decode()
    return {"image": b64, "width": frame.shape[1], "height": frame.shape[0]}


@router.post("/set-annotate")
def set_annotate(body: SetAnnotateRequest):
    if not _worker or not _worker.is_running():
        raise HTTPException(status_code=400, detail="Detection is not running")
    _worker.set_annotate(body.annotate)
    return {"annotate": body.annotate}


@router.post("/set-email")
def set_email_live(body: SetEmailRequest):
    if not _worker or not _worker.is_running():
        raise HTTPException(status_code=400, detail="Detection is not running")
    _worker.set_email_enabled(body.enabled)
    return {"enabled": body.enabled}


@router.post("/test-smtp")
def test_smtp(body: TestSMTPRequest):
    from ..services.email_service import EmailService
    svc = EmailService({
        "enable_email": True,
        "smtp_server":   body.smtp_server,
        "smtp_port":     body.smtp_port,
        "email_sender":  body.email_sender,
        "email_password": body.email_password,
        "email_recipients": body.email_sender,
    })
    ok, msg = svc.test_connection()
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    return {"status": "ok", "message": msg}


@router.get("/config")
def get_detection_config():
    """Return saved detection config from settings.dat."""
    return dict(settings_manager.all())


@router.get("/status")
def get_status():
    running = _worker is not None and _worker.is_running()
    return {
        "running": running,
        "log": _log[-50:],
        "alerts": _alerts[-50:],
    }


@router.get("/metrics")
def get_metrics():
    return analytics_service.get_current()


def _stream_quality() -> int:
    source = _last_config.get("source", "0")
    is_live = source.isdigit() or source.lower().startswith(("rtsp://", "rtmp://"))
    return 50 if is_live else 85


@router.get("/stream")
def video_stream():
    return StreamingResponse(
        mjpeg_generator(_frame_queue, quality=_stream_quality()),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )
