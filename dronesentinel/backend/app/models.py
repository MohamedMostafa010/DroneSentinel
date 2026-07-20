from pydantic import BaseModel
from typing import Optional, Dict, Any, List


class DetectionConfig(BaseModel):
    model_path: str
    source: str = "0"
    confidence: float = 0.25
    save_dir: str = "runs/detect"
    show_video: bool = True
    enable_email: bool = False
    smtp_server: str = "smtp.gmail.com"
    smtp_port: int = 587
    email_sender: str = ""
    email_password: str = ""
    email_recipients: str = ""
    send_summary_email: bool = True
    send_instant_alerts: bool = False
    # Alert cooldown: minimum seconds between alerts for the same track ID
    alert_cooldown_seconds: int = 30
    # Region of interest: list of [x, y] normalized [0,1] polygon vertices.
    # Empty = full frame. Example: [[0.1,0.1],[0.9,0.1],[0.9,0.9],[0.1,0.9]]
    roi_polygon: List = []
    # Auto-restart worker if it crashes unexpectedly
    auto_restart: bool = False


class TrainingConfig(BaseModel):
    data_yaml: str
    model: str = "yolo26s.pt"
    epochs: int = 30
    imgsz: int = 640
    batch: int = 16
    name: str = "dronesentinel_train"
    project: str = "runs/train"
    patience: Optional[int] = 15
    workers: Optional[int] = 0
    lr0: Optional[float] = 0.002
    mosaic: Optional[float] = 1.0
    device: Optional[str] = "0"


class DroneRecord(BaseModel):
    drone_id: int
    first_detected: int
    last_detected: int
    detection_count: int
    max_confidence: float
    track_history: List = []


class MetricsUpdate(BaseModel):
    total_drones: int = 0
    active_drones: int = 0
    avg_confidence: float = 0.0
    fps: float = 0.0
    alerts_sent: int = 0
    detected_drones: Dict[str, Any] = {}


class SettingsUpdate(BaseModel):
    settings: Dict[str, Any]


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class PasswordSet(BaseModel):
    password: str


class AdminLogin(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username: str
    password: str
    role: str  # "admin" | "operator" | "technical"


class UserUpdate(BaseModel):
    new_username: Optional[str] = None
    new_password: Optional[str] = None
    new_role: Optional[str] = None


class SwitchSourceRequest(BaseModel):
    source: str


class SetAnnotateRequest(BaseModel):
    annotate: bool


class SetEmailRequest(BaseModel):
    enabled: bool


class TestSMTPRequest(BaseModel):
    smtp_server: str
    smtp_port: int
    email_sender: str
    email_password: str
