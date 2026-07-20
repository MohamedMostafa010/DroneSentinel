import json
import os
from .encryption import EncryptionManager
from .config import SETTINGS_FILE, DEFAULT_SETTINGS


class SettingsManager:
    def __init__(self):
        self.encryption = EncryptionManager()
        self.settings_file = SETTINGS_FILE
        self.settings = self._load_settings()

    def _load_settings(self):
        defaults = dict(DEFAULT_SETTINGS)
        if os.path.exists(self.settings_file):
            try:
                temp = self.settings_file + ".tmp"
                self.encryption.decrypt_file(self.settings_file, temp)
                with open(temp, "r") as f:
                    loaded = json.load(f)
                os.remove(temp)
                defaults.update(loaded)
            except Exception:
                pass
        return defaults

    def save(self):
        temp = self.settings_file + ".tmp"
        with open(temp, "w") as f:
            json.dump(self.settings, f, indent=2)
        self.encryption.encrypt_file(temp, self.settings_file)
        os.remove(temp)

    def get(self, key: str, default=None):
        return self.settings.get(key, default)

    def set(self, key: str, value):
        self.settings[key] = value

    def update(self, data: dict):
        self.settings.update(data)
        self.save()

    def all(self) -> dict:
        return dict(self.settings)


settings_manager = SettingsManager()
