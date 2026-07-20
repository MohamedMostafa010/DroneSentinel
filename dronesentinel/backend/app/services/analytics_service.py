import os
from collections import deque
from datetime import datetime
from typing import Dict, Any


def _fmt_duration(sec: float) -> str:
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = int(sec % 60)
    if h:
        return f"{h}h {m}m {s}s"
    return f"{m}m {s}s" if m else f"{s}s"


class AnalyticsService:
    def __init__(self):
        self.fps_history:     deque            = deque(maxlen=30)
        self.current_metrics: Dict[str, Any]   = {}
        self.detected_drones: Dict[int, Dict]  = {}
        self.alerts_sent:     int              = 0
        self.start_time:      datetime | None  = None
        self._source:         str              = ""
        self._model_path:     str              = ""

    def reset(self):
        self.fps_history.clear()
        self.current_metrics = {}
        self.detected_drones = {}
        self.alerts_sent = 0
        self.start_time  = datetime.now()

    def set_session_info(self, source: str, model_path: str):
        self._source     = str(source)
        self._model_path = str(model_path)

    def update(self, metrics: Dict[str, Any]):
        self.current_metrics = metrics
        self.fps_history.append(metrics.get("fps", 0))
        self.alerts_sent = metrics.get("alerts_sent", 0)
        # detected_drones is managed exclusively by record_drone(); never overwrite here

    def get_fps_history(self) -> list:
        return list(self.fps_history)

    def get_current(self) -> Dict[str, Any]:
        # ── session metadata ──────────────────────────────────────────────────
        now  = datetime.now()
        dur  = (now - self.start_time).total_seconds() if self.start_time else 0.0
        src  = self._source
        if src.isdigit():
            src_display = f"Webcam (index {src})"
        elif src.lower().startswith("rtsp://"):
            src_display = "RTSP Stream"
        elif src:
            src_display = f"File: {os.path.basename(src)}"
        else:
            src_display = "Unknown"

        # ── JSON-safe detected_drones (no track_history / no numpy types) ────
        safe_drones = {
            str(tid): {
                "detection_count": int(d["detection_count"]),
                "first_detected":  int(d["first_detected"]),
                "last_detected":   int(d["last_detected"]),
                "min_confidence":  float(d["min_confidence"]),
                "avg_confidence":  float(d["avg_confidence"]),
                "max_confidence":  float(d["max_confidence"]),
            }
            for tid, d in self.detected_drones.items()
        }

        return {
            # ── session ───────────────────────────────────────────────────────
            "session_start":    self.start_time.strftime("%Y-%m-%d %H:%M:%S") if self.start_time else "",
            "duration_seconds": round(dur, 1),
            "duration":         _fmt_duration(dur),
            "source":           src_display,
            "model":            os.path.basename(self._model_path) if self._model_path else "N/A",
            # ── live summary ──────────────────────────────────────────────────
            **self.current_metrics,
            # ── per-drone ─────────────────────────────────────────────────────
            "detected_drones":  safe_drones,
            "fps_history":      self.get_fps_history(),
        }

    def record_drone(self, track_id: int, frame_count: int, confidence: float,
                     history: list):
        conf = float(confidence)
        if track_id not in self.detected_drones:
            self.detected_drones[track_id] = {
                "first_detected":  frame_count,
                "last_detected":   frame_count,
                "detection_count": 1,
                "max_confidence":  conf,
                "min_confidence":  conf,
                "avg_confidence":  conf,
                "track_history":   history,
            }
            return True   # new drone
        else:
            d = self.detected_drones[track_id]
            n = d["detection_count"] + 1
            d["last_detected"]   = frame_count
            d["detection_count"] = n
            d["max_confidence"]  = float(max(d["max_confidence"], conf))
            d["min_confidence"]  = float(min(d["min_confidence"], conf))
            d["avg_confidence"]  = float(d["avg_confidence"] + (conf - d["avg_confidence"]) / n)
            d["track_history"]   = history
            return False  # existing drone


analytics_service = AnalyticsService()
