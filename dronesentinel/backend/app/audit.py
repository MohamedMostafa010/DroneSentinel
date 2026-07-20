"""
Encrypted append-only audit log.
Every admin action (login, password change, settings update, export) is
recorded here with a UTC timestamp. The file is AES-256 encrypted using
the same key as all other config files.
"""
import json
import os
import threading
from datetime import datetime

from .encryption import EncryptionManager
from .config import AUDIT_FILE


class AuditLog:
    def __init__(self):
        self.encryption = EncryptionManager()
        self.log_file = AUDIT_FILE
        self._lock = threading.Lock()

    def log(self, action: str, details: str = "", ip: str = "unknown"):
        entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "action": action,
            "details": details,
            "ip": ip,
        }
        with self._lock:
            entries = self._read_entries()
            entries.append(entry)
            self._write_entries(entries)

    def _read_entries(self) -> list:
        if not os.path.exists(self.log_file):
            return []
        try:
            tmp = self.log_file + ".rtmp"
            self.encryption.decrypt_file(self.log_file, tmp)
            with open(tmp, "r") as f:
                data = json.load(f)
            os.remove(tmp)
            return data if isinstance(data, list) else []
        except Exception:
            return []

    def _write_entries(self, entries: list):
        tmp = self.log_file + ".wtmp"
        with open(tmp, "w") as f:
            json.dump(entries, f, indent=2)
        self.encryption.encrypt_file(tmp, self.log_file)
        os.remove(tmp)

    def get_all(self) -> list:
        with self._lock:
            return self._read_entries()


audit_log = AuditLog()
