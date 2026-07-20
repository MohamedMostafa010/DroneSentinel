from fastapi import APIRouter
from fastapi.responses import FileResponse
import tempfile
from datetime import datetime

from ..services.analytics_service import analytics_service
from ..utils.export import DataExportManager
from ..database import get_sessions

router = APIRouter(prefix="/analytics", tags=["analytics"])

# Frozen export snapshot — set by POST /analytics/snapshot, read by all export routes.
# This guarantees CSV / JSON / PDF / HTML always contain identical values.
_snapshot: dict = {}
_snapshot_at: str = ""


@router.get("/metrics")
def get_metrics():
    return analytics_service.get_current()


@router.get("/last-session")
def get_last_session():
    """Return the most recent detection session summary (no auth required)."""
    sessions = get_sessions(1)
    return {"session": sessions[0] if sessions else None}


@router.post("/snapshot")
def take_snapshot():
    """Freeze the current analytics state. All /export/* routes read from this."""
    global _snapshot, _snapshot_at
    _snapshot    = analytics_service.get_current()
    _snapshot_at = datetime.now().strftime("%H:%M:%S")
    return {
        "ok":            True,
        "snapshot_at":   _snapshot_at,
        "total_frames":  _snapshot.get("total_frames", 0),
        "total_drones":  _snapshot.get("total_drones", 0),
        "duration":      _snapshot.get("duration", ""),
        "avg_fps":       round(float(_snapshot.get("fps", 0)), 1),
    }


def _get_data() -> dict:
    """Return the frozen snapshot, or a live reading if no snapshot exists yet."""
    return _snapshot if _snapshot else analytics_service.get_current()


@router.get("/export/csv")
def export_csv():
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".csv")
    tmp.close()
    DataExportManager.to_csv(_get_data(), tmp.name)
    return FileResponse(tmp.name, media_type="text/csv",
                        filename="dronesentinel_report.csv")


@router.get("/export/json")
def export_json():
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".json")
    tmp.close()
    DataExportManager.to_json(_get_data(), tmp.name)
    return FileResponse(tmp.name, media_type="application/json",
                        filename="dronesentinel_report.json")


@router.get("/export/pdf")
def export_pdf():
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    tmp.close()
    DataExportManager.to_pdf(_get_data(), tmp.name)
    return FileResponse(tmp.name, media_type="application/pdf",
                        filename="dronesentinel_report.pdf")


@router.get("/export/html")
def export_html():
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".html")
    tmp.close()
    DataExportManager.to_html(_get_data(), tmp.name)
    return FileResponse(tmp.name, media_type="text/html",
                        filename="dronesentinel_report.html")
