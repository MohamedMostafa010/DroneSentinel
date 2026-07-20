import os
import cv2
import time
import numpy as np
from collections import deque
from datetime import datetime
from threading import Thread, Event, Lock

from ..services.detector import DroneDetector
from ..services.tracker import BotSortTracker
from ..services.email_service import EmailService
from ..services.analytics_service import analytics_service
from ..database import save_session, save_drone_records
from ..encryption import EncryptionManager

INFER_W, INFER_H = 2560, 1440

# HEVC main-stream benchmark results vs H264 sub-stream:
# Jitter:  73ms vs 142ms  (-49%)
# p95:     66ms vs 105ms  (-37%)
# Dropped: 0/60 vs 1/60
# Use subtype=0 (main stream, 1280x720 HEVC @20fps)
RECOMMENDED_RTSP = "rtsp://admin:PASSWORD@CAMERA_IP:554/cam/realmonitor?channel=1&subtype=0"

# RTSP reconnection: max attempts and backoff cap in seconds
MAX_RECONNECT_ATTEMPTS = 10
MAX_BACKOFF_SECONDS = 30


def _build_alert_html(tid: int, conf: float, frame: int, dt) -> str:
    """Compact inline-CSS HTML for an instant drone-detection alert email."""
    conf_color = "#00e676" if conf >= 0.7 else "#ffb300" if conf >= 0.45 else "#ff6b35"
    bar_w      = round(conf * 100)
    dt_str     = dt.strftime("%Y-%m-%d  %H:%M:%S")
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0b1018;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"
         style="max-width:480px;margin:32px auto;background:#0d1520;
                border:1px solid #1a2232;border-top:3px solid #ff6b35;">
    <!-- Header -->
    <tr>
      <td style="padding:20px 24px 14px 24px;border-bottom:1px solid #1a2232;">
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding-right:12px;">
              <div style="width:36px;height:36px;background:#ff6b3520;border:1px solid #ff6b3540;
                          border-radius:50%;text-align:center;line-height:36px;
                          font-size:17px;color:#ff6b35;">&#9888;</div>
            </td>
            <td>
              <p style="margin:0;font-size:11px;letter-spacing:0.25em;
                        text-transform:uppercase;color:#ff6b35;">Drone Detected</p>
              <p style="margin:2px 0 0 0;font-size:18px;font-weight:700;color:#e6edf3;">
                Drone #{tid}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Confidence -->
    <tr>
      <td style="padding:16px 24px 8px 24px;">
        <p style="margin:0 0 6px 0;font-size:10px;letter-spacing:0.2em;
                  text-transform:uppercase;color:#6e7a8a;">CONFIDENCE</p>
        <p style="margin:0 0 8px 0;font-size:28px;font-weight:700;color:{conf_color};">{conf:.3f}</p>
        <div style="background:#1a2232;height:6px;border-radius:3px;">
          <div style="background:{conf_color};height:6px;border-radius:3px;width:{bar_w}%;"></div>
        </div>
      </td>
    </tr>

    <!-- Meta row -->
    <tr>
      <td style="padding:12px 24px 20px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:50%;">
              <p style="margin:0;font-size:10px;letter-spacing:0.15em;
                        text-transform:uppercase;color:#6e7a8a;">FRAME</p>
              <p style="margin:3px 0 0 0;font-size:13px;color:#e6edf3;
                        font-family:'Courier New',monospace;">{frame:,}</p>
            </td>
            <td style="width:50%;">
              <p style="margin:0;font-size:10px;letter-spacing:0.15em;
                        text-transform:uppercase;color:#6e7a8a;">TIME</p>
              <p style="margin:3px 0 0 0;font-size:13px;color:#e6edf3;
                        font-family:'Courier New',monospace;">{dt_str}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding:10px 24px;background:#0b1018;border-top:1px solid #1a2232;
                 text-align:center;">
        <p style="margin:0;font-size:10px;color:#4a5568;letter-spacing:0.08em;">
          <span style="color:#00d4ff;">&#9672; DroneSentinel</span>
          &nbsp;&mdash;&nbsp;AI Drone Detection System
        </p>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _build_summary_html(
    dt, duration_sec: float, frame_count: int, avg_fps: float,
    source: str, model_path: str, alerts_sent: int, drones: dict,
) -> str:
    """Build the full-session HTML report (inline styles — email + browser safe)."""
    import os as _os

    def _fmt_duration(sec: float) -> str:
        h = int(sec // 3600)
        m = int((sec % 3600) // 60)
        s = int(sec % 60)
        if h:
            return f"{h}h {m}m {s}s"
        return f"{m}m {s}s" if m else f"{s}s"

    model_name = _os.path.basename(model_path) if model_path else "N/A"
    src_display = f"Webcam (index {source})" if str(source).isdigit() else source

    # ── drone section (one block per drone) ──────────────────────────────────
    drone_html = ""
    for tid, d in sorted(drones.items(), key=lambda x: x[0]):
        det_count  = d.get("detection_count", 0)
        min_conf   = d.get("min_confidence", 0.0)
        max_conf   = d.get("max_confidence", 0.0)
        avg_conf   = d.get("avg_confidence", 0.0)
        first_fr   = d.get("first_detected", 0)
        last_fr    = d.get("last_detected", 0)
        bar_pct    = round(avg_conf * 100, 1)
        bar_min    = round(min_conf * 100, 1)
        range_start = round((min_conf / max_conf) * 100, 1) if max_conf else 0

        drone_html += f"""
  <div style="padding:0 40px 32px 40px;">
    <h2 style="margin:0 0 16px 0;font-size:11px;letter-spacing:0.25em;
               text-transform:uppercase;color:#6e7a8a;
               border-bottom:1px solid #1a2232;padding-bottom:10px;">
      DRONE #{tid} &mdash; DETECTION SUMMARY
    </h2>

    <!-- Stat cards row -->
    <div style="display:flex;gap:16px;margin-bottom:24px;">

      <div style="flex:1;background:#0d1520;border:1px solid #1a2232;
                  border-top:2px solid #00d4ff;padding:16px 20px;">
        <p style="margin:0 0 6px 0;font-size:10px;letter-spacing:0.2em;
                  text-transform:uppercase;color:#6e7a8a;">TOTAL DETECTIONS</p>
        <p style="margin:0;font-size:28px;font-weight:700;color:#00d4ff;">{det_count:,}</p>
      </div>

      <div style="flex:1;background:#0d1520;border:1px solid #1a2232;
                  border-top:2px solid #ffb300;padding:16px 20px;">
        <p style="margin:0 0 6px 0;font-size:10px;letter-spacing:0.2em;
                  text-transform:uppercase;color:#6e7a8a;">AVG CONFIDENCE</p>
        <p style="margin:0;font-size:28px;font-weight:700;color:#ffb300;">{avg_conf:.3f}</p>
      </div>

      <div style="flex:1;background:#0d1520;border:1px solid #1a2232;
                  border-top:2px solid #00e676;padding:16px 20px;">
        <p style="margin:0 0 6px 0;font-size:10px;letter-spacing:0.2em;
                  text-transform:uppercase;color:#6e7a8a;">PEAK CONFIDENCE</p>
        <p style="margin:0;font-size:28px;font-weight:700;color:#00e676;">{max_conf:.3f}</p>
      </div>

    </div>

    <!-- Details table -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr style="background:#0d1520;">
        <td style="padding:10px 14px;font-size:11px;color:#6e7a8a;
                   letter-spacing:0.12em;text-transform:uppercase;width:200px;">
          FIRST DETECTED</td>
        <td style="padding:10px 14px;font-size:13px;color:#e6edf3;">
          Frame {first_fr:,}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-size:11px;color:#6e7a8a;
                   letter-spacing:0.12em;text-transform:uppercase;">
          LAST DETECTED</td>
        <td style="padding:10px 14px;font-size:13px;color:#e6edf3;">
          Frame {last_fr:,}</td>
      </tr>
      <tr style="background:#0d1520;">
        <td style="padding:10px 14px;font-size:11px;color:#6e7a8a;
                   letter-spacing:0.12em;text-transform:uppercase;">
          MIN CONFIDENCE</td>
        <td style="padding:10px 14px;font-size:13px;color:#e6edf3;">
          {min_conf:.3f}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-size:11px;color:#6e7a8a;
                   letter-spacing:0.12em;text-transform:uppercase;">
          AVG CONFIDENCE</td>
        <td style="padding:10px 14px;font-size:13px;color:#ffb300;font-weight:600;">
          {avg_conf:.3f}</td>
      </tr>
      <tr style="background:#0d1520;">
        <td style="padding:10px 14px;font-size:11px;color:#6e7a8a;
                   letter-spacing:0.12em;text-transform:uppercase;">
          MAX CONFIDENCE</td>
        <td style="padding:10px 14px;font-size:13px;color:#00e676;font-weight:600;">
          {max_conf:.3f}</td>
      </tr>
    </table>

    <!-- Confidence range bar -->
    <p style="margin:0 0 8px 0;font-size:10px;letter-spacing:0.15em;
              text-transform:uppercase;color:#6e7a8a;">CONFIDENCE RANGE</p>
    <div style="background:#1a2232;height:8px;border-radius:4px;
                position:relative;margin-bottom:6px;">
      <div style="background:linear-gradient(90deg,#ffb300,#00e676);
                  height:8px;border-radius:4px;
                  margin-left:{range_start}%;
                  width:{bar_pct - bar_min}%;"></div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:4px;">
      <span style="font-size:10px;color:#6e7a8a;">{min_conf:.3f} (min)</span>
      <span style="font-size:10px;color:#ffb300;">{avg_conf:.3f} (avg)</span>
      <span style="font-size:10px;color:#6e7a8a;">{max_conf:.3f} (max)</span>
    </div>
  </div>
"""

    dt_str = dt.strftime("%Y-%m-%d %H:%M:%S")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>DroneSentinel Report &mdash; {dt_str}</title>
</head>
<body style="margin:0;padding:0;background:#0b1018;color:#e6edf3;
             font-family:'Segoe UI',Arial,sans-serif;">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#0d1520 0%,#0b1018 100%);
              border-bottom:2px solid #00d4ff30;padding:32px 40px;">
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:6px;">
      <span style="font-size:26px;color:#00d4ff;">&#9672;</span>
      <span style="font-size:20px;font-weight:700;letter-spacing:0.18em;
                   color:#e6edf3;text-transform:uppercase;">DroneSentinel</span>
    </div>
    <p style="margin:0;font-size:11px;color:#6e7a8a;letter-spacing:0.25em;
              text-transform:uppercase;">Detection Session Report</p>
    <p style="margin:10px 0 0 0;font-size:12px;color:#4a5568;">{dt_str}</p>
  </div>

  <!-- Session overview -->
  <div style="padding:32px 40px;">
    <h2 style="margin:0 0 16px 0;font-size:11px;letter-spacing:0.25em;
               text-transform:uppercase;color:#6e7a8a;
               border-bottom:1px solid #1a2232;padding-bottom:10px;">
      SESSION OVERVIEW
    </h2>
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:9px 0;font-size:11px;color:#6e7a8a;
                   letter-spacing:0.12em;text-transform:uppercase;width:200px;">DATE</td>
        <td style="padding:9px 0;font-size:13px;color:#e6edf3;">{dt_str}</td>
      </tr>
      <tr>
        <td style="padding:9px 0;font-size:11px;color:#6e7a8a;
                   letter-spacing:0.12em;text-transform:uppercase;">DURATION</td>
        <td style="padding:9px 0;font-size:13px;color:#e6edf3;">{_fmt_duration(duration_sec)}</td>
      </tr>
      <tr>
        <td style="padding:9px 0;font-size:11px;color:#6e7a8a;
                   letter-spacing:0.12em;text-transform:uppercase;">TOTAL FRAMES</td>
        <td style="padding:9px 0;font-size:13px;color:#e6edf3;">{frame_count:,}</td>
      </tr>
      <tr>
        <td style="padding:9px 0;font-size:11px;color:#6e7a8a;
                   letter-spacing:0.12em;text-transform:uppercase;">AVERAGE FPS</td>
        <td style="padding:9px 0;font-size:13px;color:#00d4ff;">{avg_fps:.1f}</td>
      </tr>
      <tr>
        <td style="padding:9px 0;font-size:11px;color:#6e7a8a;
                   letter-spacing:0.12em;text-transform:uppercase;">SOURCE</td>
        <td style="padding:9px 0;font-size:13px;color:#e6edf3;">{src_display}</td>
      </tr>
      <tr>
        <td style="padding:9px 0;font-size:11px;color:#6e7a8a;
                   letter-spacing:0.12em;text-transform:uppercase;">MODEL</td>
        <td style="padding:9px 0;font-size:13px;color:#e6edf3;">{model_name}</td>
      </tr>
      <tr>
        <td style="padding:9px 0;font-size:11px;color:#6e7a8a;
                   letter-spacing:0.12em;text-transform:uppercase;">ALERTS SENT</td>
        <td style="padding:9px 0;font-size:14px;color:#ff6b35;font-weight:700;">{alerts_sent}</td>
      </tr>
    </table>
  </div>

  {drone_html}

  <!-- Footer -->
  <div style="border-top:1px solid #1a2232;padding:20px 40px;text-align:center;
              background:#0d1520;">
    <p style="margin:0;font-size:11px;color:#4a5568;letter-spacing:0.08em;">
      Generated by <strong style="color:#00d4ff;">DroneSentinel</strong>
      &mdash; AI Drone Detection System &mdash; {dt_str}
    </p>
  </div>

</body>
</html>"""


# ── Thread 1: FrameReader ─────────────────────────────────────────────────────
# Tries GPU RTSP decoding via cv2.cudacodec first (NVDEC hardware decoder).
# Falls back to CPU FFmpeg if cudacodec fails (e.g. webcam, file source).
# RTSP-specific sources automatically retry with exponential backoff on disconnect.
class FrameReader:
    def __init__(self, source):
        self._lock    = Lock()
        self._frame   = None
        self._fid     = 0
        self.ok       = False
        self._stop    = Event()
        self._use_gpu = False
        self._reader  = None   # cudacodec.VideoReader
        self.cap      = None   # cv2.VideoCapture (CPU fallback)
        self._w = 0
        self._h = 0
        self._fps = 20
        self._source = source

        # Try GPU decoder first — only works for RTSP/H264/HEVC, not webcams
        is_rtsp = isinstance(source, str) and source.startswith("rtsp://")
        if is_rtsp and hasattr(cv2, "cudacodec"):
            try:
                params = cv2.cudacodec.VideoReaderInitParams()
                params.allowFrameDrop = True
                self._reader  = cv2.cudacodec.createVideoReader(source, params=params)
                fmt           = self._reader.format()
                self._w       = fmt.width
                self._h       = fmt.height
                self._fps     = 20  # cudacodec doesn't expose FPS directly
                self._use_gpu = True
            except Exception:
                self._reader  = None
                self._use_gpu = False

        # CPU fallback
        if not self._use_gpu:
            self._open_cpu()

        self._thread = Thread(target=self._read, daemon=True, name="FrameReader")

    def _open_cpu(self):
        """Open or reopen the CPU VideoCapture.
        - USB cameras (integer index): CAP_DSHOW → MSMF → ANY fallback chain.
        - Video files (path to existing file): plain VideoCapture, no RTSP options.
        - RTSP streams: CAP_FFMPEG with low-latency buffering options.
        """
        if self.cap:
            self.cap.release()

        src_str  = str(self._source).strip()
        is_usb   = src_str.isdigit()
        is_file  = not is_usb and os.path.isfile(src_str)
        self._is_file = is_file

        if is_usb:
            idx = int(self._source)
            # Try backends in order of preference. Some cameras only work with
            # specific backends — DSHOW fails silently on some MJPEG webcams
            # when requested resolution isn't natively supported.
            self.cap = None
            for backend in (cv2.CAP_DSHOW, cv2.CAP_MSMF, cv2.CAP_ANY):
                try:
                    cap = cv2.VideoCapture(idx, backend)
                    if not cap.isOpened():
                        cap.release()
                        continue
                    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1920)
                    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1088)
                    cap.set(cv2.CAP_PROP_FPS, 30)
                    # Verify frames actually arrive before committing to this backend
                    ret, _ = cap.read()
                    if ret:
                        self.cap = cap
                        break
                    cap.release()
                except Exception:
                    pass
            if self.cap is None:
                self.cap = cv2.VideoCapture(idx)

        elif is_file:
            # Video file — open plainly, no RTSP/buffering options that corrupt seeking
            self.cap = cv2.VideoCapture(src_str)

        else:
            # RTSP stream — low-latency FFMPEG options
            os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = (
                "rtsp_transport;tcp|fflags;nobuffer|flags;low_delay|thread_queue_size;512"
            )
            self.cap = cv2.VideoCapture(self._source, cv2.CAP_FFMPEG)
            self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        self._fps = int(self.cap.get(cv2.CAP_PROP_FPS)) or 30
        self._w   = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        self._h   = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    def start(self):
        self._thread.start()
        return self

    def _read(self):
        if self._use_gpu:
            self._read_gpu()
        else:
            self._read_cpu_with_reconnect()
        # Signal to DetectionWorker that the source is exhausted (file ended /
        # webcam disconnected / RTSP gave up). Without this, DetectionWorker
        # spins on fid==last_fid forever because self._frame still holds the
        # last good frame and self.ok is still True.
        with self._lock:
            self.ok = False

    def _read_gpu(self):
        """GPU path: NVDEC decode → GpuMat → download to CPU."""
        while not self._stop.is_set():
            try:
                ret, gpu_frame = self._reader.nextFrame()
                if ret and gpu_frame is not None:
                    frame = gpu_frame.download()
                    if frame is not None and frame.size > 0:
                        if frame.shape[2] == 4:
                            frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)
                        with self._lock:
                            self._frame = frame
                            self._fid  += 1
                            self.ok     = True
                else:
                    time.sleep(0.005)
            except Exception:
                break

    def _read_cpu_with_reconnect(self):
        """CPU path with RTSP reconnection and exponential backoff."""
        is_rtsp = isinstance(self._source, str) and self._source.startswith("rtsp://")
        is_file = getattr(self, "_is_file", False)
        fail_streak = 0
        reconnect_attempts = 0
        backoff = 1.0

        # Video files have no hardware clock — cap.read() returns frames as fast
        # as the CPU can read them.  Throttle to the file's native FPS so that
        # DetectionWorker sees frames at the right cadence instead of receiving
        # the last frame of the file almost instantly.
        frame_interval = (1.0 / self._fps) if (is_file and self._fps > 0) else 0.0
        last_read_time = 0.0

        while not self._stop.is_set():
            # Pace video-file reads to native FPS
            if is_file and frame_interval > 0:
                elapsed = time.monotonic() - last_read_time
                remaining = frame_interval - elapsed
                if remaining > 0:
                    time.sleep(remaining)

            try:
                ret, frame = self.cap.read()
            except Exception:
                ret, frame = False, None

            if ret and frame is not None:
                last_read_time = time.monotonic()
                with self._lock:
                    self._frame = frame
                    self._fid  += 1
                    self.ok     = True
                fail_streak = 0
                reconnect_attempts = 0
                backoff = 1.0
            else:
                fail_streak += 1
                # Short buffer before deciding to reconnect
                if fail_streak < 10:
                    time.sleep(0.02)
                    continue

                if not is_rtsp:
                    # Non-RTSP (file ended / webcam disconnected): stop reading
                    break

                # RTSP disconnect → try to reconnect
                if reconnect_attempts >= MAX_RECONNECT_ATTEMPTS:
                    # Give up — let DetectionWorker handle the failure
                    break

                reconnect_attempts += 1
                sleep_time = min(backoff, MAX_BACKOFF_SECONDS)
                time.sleep(sleep_time)
                backoff = min(backoff * 2, MAX_BACKOFF_SECONDS)
                fail_streak = 0

                try:
                    self._open_cpu()
                except Exception:
                    pass

    def get(self):
        with self._lock:
            return self.ok, self._frame, self._fid

    def props(self):
        return self._fps, self._w, self._h

    def decoder_info(self):
        return "NVDEC (GPU)" if self._use_gpu else "FFmpeg (CPU)"

    def stop(self):
        self._stop.set()
        time.sleep(0.15)
        if self.cap:
            self.cap.release()


# ── Thread 2: DetectionWorker (YOLO + tracking + MJPEG push) ─────────────────
class DetectionWorker:
    def __init__(self, config: dict, on_progress=None, on_alert=None,
                 on_metrics=None, on_finished=None, frame_queue=None):
        self.config      = config
        self.on_progress = on_progress  or (lambda msg: None)
        self.on_alert    = on_alert     or (lambda msg: None)
        self.on_metrics  = on_metrics   or (lambda m:   None)
        self.on_finished = on_finished  or (lambda ok, msg: None)
        self.frame_queue = frame_queue  # queue.Queue — push annotated frames here
        self.encryption  = EncryptionManager()
        self._stop_event = Event()
        self._thread: Thread | None = None
        self.frame_times: deque = deque(maxlen=60)
        self._switch_lock    = Lock()
        self._pending_source: str | None = None
        self._annotate       = True
        self._annotate_lock  = Lock()
        self._email_live     = bool(config.get("enable_email", False))
        self._email_service: "EmailService | None" = None

    def switch_source(self, new_source: str):
        """Request a live source switch. Picked up by the main loop next iteration."""
        with self._switch_lock:
            self._pending_source = new_source

    def set_annotate(self, val: bool):
        with self._annotate_lock:
            self._annotate = val

    def set_email_enabled(self, val: bool):
        self._email_live = val
        if self._email_service is not None:
            self._email_service.config["enable_email"] = val

    def start(self):
        analytics_service.reset()
        self._stop_event.clear()
        self._thread = Thread(target=self._run, daemon=True, name="YOLOWorker")
        self._thread.start()

    def stop(self):
        self._stop_event.set()

    def is_running(self):
        return self._thread is not None and self._thread.is_alive()

    def _push_frame(self, frame):
        if self.frame_queue is None:
            return
        try:
            if self.frame_queue.full():
                try:
                    self.frame_queue.get_nowait()
                except Exception:
                    pass
            self.frame_queue.put_nowait(frame)
        except Exception:
            pass

    @staticmethod
    def _point_in_roi(cx: float, cy: float, roi_polygon: list) -> bool:
        """
        Check if (cx, cy) in pixel coords falls inside the ROI polygon.
        roi_polygon is [[x0,y0],[x1,y1],...] in normalized [0,1] coords,
        already scaled to INFER_W/INFER_H before this call.
        Returns True if inside (or if polygon is empty = full frame).
        """
        if not roi_polygon:
            return True
        pts = np.array(roi_polygon, dtype=np.float32)
        result = cv2.pointPolygonTest(pts, (float(cx), float(cy)), False)
        return result >= 0

    def _run(self):
        reader = None
        start_time = datetime.now()
        success = False
        frame_count = 0
        alerts_sent = 0

        try:
            source     = self.config.get("source", "0")
            cooldown   = int(self.config.get("alert_cooldown_seconds", 30))
            model_path = self.config.get("model_path", "")
            analytics_service.set_session_info(source=str(source), model_path=model_path)

            # Convert normalized ROI polygon to pixel coordinates
            raw_roi = self.config.get("roi_polygon", [])
            if raw_roi:
                roi_polygon = [
                    [pt[0] * INFER_W, pt[1] * INFER_H]
                    for pt in raw_roi
                ]
            else:
                roi_polygon = []

            reader = FrameReader(source).start()

            for _ in range(80):
                if reader.ok:
                    break
                time.sleep(0.1)

            if not reader.ok:
                self.on_finished(False, "Cannot open video source")
                return

            fps_src, w, h = reader.props()
            roi_info = f" | ROI active ({len(roi_polygon)} pts)" if roi_polygon else ""
            self.on_progress(
                f"Stream: {w}x{h} @ {fps_src}fps | "
                f"decoder: {reader.decoder_info()} | "
                f"inference: {INFER_W}x{INFER_H}"
                f"{roi_info}"
            )

            detector      = DroneDetector(model_path, self.config.get("confidence", 0.25))
            tracker       = BotSortTracker(self.config.get("confidence", 0.25))
            self._email_service = EmailService(dict(self.config))
            self._email_service.config["enable_email"] = self._email_live
            email_service = self._email_service

            save_dir = self.config.get("save_dir", "runs/detect")
            os.makedirs(save_dir, exist_ok=True)
            existing  = [d for d in os.listdir(save_dir) if d.startswith("track")]
            track_dir = os.path.join(save_dir, f"track{len(existing)+1}_botsort")
            os.makedirs(track_dir, exist_ok=True)

            out = cv2.VideoWriter(
                os.path.join(track_dir, "output.mp4"),
                cv2.VideoWriter_fourcc(*"mp4v"),
                fps_src, (INFER_W, INFER_H)
            )

            fail_count    = 0
            alerted_ids: dict = {}  # track_id → last alert timestamp
            last_fid      = -1
            last_tracks   = []
            YOLO_EVERY    = 2

            while not self._stop_event.is_set():
                # ── Live source switch ────────────────────────────────────────
                with self._switch_lock:
                    pending = self._pending_source
                    self._pending_source = None

                if pending is not None:
                    self.on_progress(f"↔ Switching source to: {pending}")
                    new_reader = FrameReader(pending).start()
                    # Wait up to 3 s for the new source to produce a frame
                    for _ in range(30):
                        if new_reader.ok:
                            break
                        time.sleep(0.1)

                    if new_reader.ok:
                        reader.stop()
                        reader   = new_reader
                        source   = pending
                        last_fid = -1
                        fail_count = 0
                        fps_src, w, h = reader.props()
                        analytics_service.set_session_info(
                            source=str(source), model_path=model_path
                        )
                        self.on_progress(
                            f"✓ Switched → {w}x{h} @ {fps_src}fps | "
                            f"decoder: {reader.decoder_info()}"
                        )
                    else:
                        new_reader.stop()
                        self.on_progress(
                            f"⚠ Switch failed: cannot open '{pending}' — "
                            "keeping previous source"
                        )

                ok, frame, fid = reader.get()

                if not ok or frame is None:
                    fail_count += 1
                    if fail_count >= 40:
                        self.on_progress("❌ Camera disconnected.")
                        break
                    time.sleep(0.02)
                    continue

                if fid == last_fid:
                    time.sleep(0.003)
                    continue

                last_fid    = fid
                fail_count  = 0
                frame_count += 1
                t0 = time.time()

                small = cv2.resize(frame, (INFER_W, INFER_H))
                self._push_frame(small)

                if frame_count % YOLO_EVERY == 0:
                    dets        = detector.detect(small)
                    last_tracks = tracker.update(dets, small)
                    # Single-drone deployment: always use ID=1
                    for _t in last_tracks:
                        _t["track_id"] = 1
                tracks = last_tracks

                # Draw ROI polygon overlay if configured
                annotated = small.copy()
                if roi_polygon:
                    pts = np.array(roi_polygon, dtype=np.int32)
                    cv2.polylines(annotated, [pts], isClosed=True, color=(0, 200, 255), thickness=2)

                for t in tracks:
                    tid          = t["track_id"]
                    x1,y1,x2,y2 = t["x1"], t["y1"], t["x2"], t["y2"]
                    conf         = t["conf"]

                    # ROI filter: skip if center of bbox is outside the defined region
                    cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
                    if not self._point_in_roi(cx, cy, roi_polygon):
                        continue

                    is_new = analytics_service.record_drone(tid, frame_count, conf, t["history"])

                    # Alert deduplication with cooldown
                    now = time.time()
                    last_alert = alerted_ids.get(tid, 0)
                    should_alert = is_new or (now - last_alert >= cooldown)

                    if should_alert:
                        alerted_ids[tid] = now
                        alerts_sent += 1
                        self.on_alert(f"Drone #{tid} ({conf:.2f})")
                        if self._email_live and self.config.get("send_instant_alerts", False):
                            email_service.send_html_async(
                                f"⚠ Drone Alert #{tid}",
                                _build_alert_html(tid, conf, frame_count, datetime.now()),
                            )

                    with self._annotate_lock:
                        do_annotate = self._annotate
                    if do_annotate:
                        pts_hist = t["history"]
                        for i in range(1, len(pts_hist)):
                            cv2.line(annotated,
                                     (int(pts_hist[i-1][0]), int(pts_hist[i-1][1])),
                                     (int(pts_hist[i][0]),   int(pts_hist[i][1])),
                                     (255, 0, 0), 2)
                        cv2.rectangle(annotated, (int(x1),int(y1)), (int(x2),int(y2)), (0,255,0), 2)
                        cv2.putText(annotated, f"#{tid} {conf:.2f}",
                                    (int(x1), max(0, int(y1)-10)),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0,255,0), 2)

                self._push_frame(annotated)
                out.write(annotated)
                self.frame_times.append(time.time() - t0)

                if frame_count % 5 == 0 and frame_count >= 5:
                    avg_fps  = len(self.frame_times)/sum(self.frame_times) if self.frame_times else 0
                    drones   = analytics_service.detected_drones
                    active   = sum(1 for d in drones.values()
                                   if d["last_detected"] > frame_count - fps_src*10)
                    avg_conf = float(np.mean([d["max_confidence"] for d in drones.values()])) if drones else 0
                    metrics  = {
                        "total_drones": len(drones), "active_drones": active,
                        "avg_confidence": avg_conf,  "fps": avg_fps,
                        "alerts_sent": alerts_sent,  "total_frames": frame_count,
                    }
                    analytics_service.update(metrics)
                    self.on_metrics(metrics)
                    if frame_count % 30 == 0:
                        self.on_progress(f"Frame {frame_count} | FPS: {avg_fps:.1f} | Active: {active}")

            # ── Cleanup ───────────────────────────────────────────────────────
            reader.stop()
            out.release()
            tracker.cleanup()

            drones        = analytics_service.detected_drones
            end_time      = datetime.now()
            avg_fps_final = (
                len(self.frame_times) / sum(self.frame_times)
                if self.frame_times else 0.0
            )
            duration_sec  = (end_time - start_time).total_seconds()

            html_report = _build_summary_html(
                dt=end_time,
                duration_sec=duration_sec,
                frame_count=frame_count,
                avg_fps=avg_fps_final,
                source=source,
                model_path=model_path,
                alerts_sent=alerts_sent,
                drones=drones,
            )
            summary_html = os.path.join(track_dir, "tracking_summary.html")
            with open(summary_html, "w", encoding="utf-8") as f:
                f.write(html_report)

            # Encrypt only the video output
            video_out = os.path.join(track_dir, "output.mp4")
            if os.path.exists(video_out):
                self.encryption.encrypt_file(video_out, video_out + ".encrypted")

            if self._email_live and self.config.get("send_summary_email", False):
                email_service.send_html_async("DroneSentinel Report", html_report)

            # ── Persist session to SQLite ──────────────────────────────────────
            try:
                avg_conf_final = (
                    float(np.mean([d["max_confidence"] for d in drones.values()]))
                    if drones else 0.0
                )
                session_id = save_session(
                    start_time=start_time,
                    end_time=datetime.now(),
                    model=model_path,
                    source=str(source),
                    total_drones=len(drones),
                    alerts_sent=alerts_sent,
                    total_frames=frame_count,
                    avg_confidence=avg_conf_final,
                    success=True,
                )
                save_drone_records(session_id, drones)
            except Exception:
                pass  # DB errors should never crash the worker

            success = True
            self.on_finished(True, f"Done. Results: {track_dir}")

        except Exception as e:
            if reader:
                reader.stop()
            # Persist failed session
            try:
                save_session(
                    start_time=start_time,
                    end_time=datetime.now(),
                    model=self.config.get("model_path", ""),
                    source=str(self.config.get("source", "")),
                    total_drones=len(analytics_service.detected_drones),
                    alerts_sent=alerts_sent,
                    total_frames=frame_count,
                    avg_confidence=0.0,
                    success=False,
                )
            except Exception:
                pass
            self.on_finished(False, f"Error: {str(e)}")
