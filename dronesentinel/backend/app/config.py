import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CONFIG_DIR = os.path.join(BASE_DIR, "config")
RUNS_DIR = os.path.join(BASE_DIR, "runs")

ENCRYPTION_KEY_FILE = os.path.join(CONFIG_DIR, "encryption.key")
USERS_FILE = os.path.join(CONFIG_DIR, "users.dat")
SETTINGS_FILE = os.path.join(CONFIG_DIR, "settings.dat")
AUDIT_FILE = os.path.join(CONFIG_DIR, "audit.log.enc")
JWT_KEY_FILE = os.path.join(CONFIG_DIR, "jwt.key")
DB_FILE = os.path.join(BASE_DIR, "dronesentinel.db")

os.makedirs(CONFIG_DIR, exist_ok=True)
os.makedirs(RUNS_DIR, exist_ok=True)

DEFAULT_SETTINGS = {
    "model_path": "",
    "source": "0",
    "confidence": 0.25,
    "save_dir": "runs/detect",
    "show_video": True,
    "enable_email": False,
    "smtp_server": "smtp.gmail.com",
    "smtp_port": 587,
    "email_sender": "",
    "email_password": "",
    "email_recipients": "",
    "send_summary_email": True,
    "send_instant_alerts": False,
}
