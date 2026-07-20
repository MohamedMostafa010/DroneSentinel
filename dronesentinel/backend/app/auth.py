import hashlib
import json
import os
import re
import secrets
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from .encryption import EncryptionManager
from .config import USERS_FILE, JWT_KEY_FILE

# ── JWT configuration ─────────────────────────────────────────────────────────
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

VALID_ROLES = {"admin", "operator", "technical"}

_USERNAME_RE = re.compile(r'^[a-zA-Z0-9_.]{3,32}$')


def validate_username(username: str) -> str | None:
    """Return an error message string, or None if the username is valid."""
    if not _USERNAME_RE.match(username):
        return "Username must be 3–32 characters: letters, digits, '_' and '.' only"
    if username.startswith('.') or username.endswith('.'):
        return "Username cannot start or end with a period"
    if '..' in username:
        return "Username cannot contain consecutive periods"
    return None


def validate_password(password: str) -> str | None:
    """Return an error message string, or None if the password meets policy."""
    if len(password) < 8:
        return "Password must be at least 8 characters"
    if not re.search(r'[A-Z]', password):
        return "Password must contain at least one uppercase letter (A–Z)"
    if not re.search(r'[a-z]', password):
        return "Password must contain at least one lowercase letter (a–z)"
    if not re.search(r'\d', password):
        return "Password must contain at least one digit (0–9)"
    if not re.search(r'[^a-zA-Z0-9]', password):
        return "Password must contain at least one special character (!@#$…)"
    return None


def _load_or_generate_jwt_secret() -> str:
    os.makedirs(os.path.dirname(JWT_KEY_FILE), exist_ok=True)
    if os.path.exists(JWT_KEY_FILE):
        with open(JWT_KEY_FILE, "r") as f:
            return f.read().strip()
    secret = secrets.token_hex(32)
    with open(JWT_KEY_FILE, "w") as f:
        f.write(secret)
    return secret


JWT_SECRET = _load_or_generate_jwt_secret()


def create_access_token(subject: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "role": role, "exp": expire, "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


def create_refresh_token(subject: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {"sub": subject, "role": role, "exp": expire, "type": "refresh"}
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


def verify_token(token: str, token_type: str = "access") -> dict | None:
    """Return decoded payload or None if invalid/expired."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        if payload.get("type") != token_type:
            return None
        return payload
    except JWTError:
        return None


# ── Multi-user auth ───────────────────────────────────────────────────────────
class UserAuth:
    def __init__(self):
        self.encryption = EncryptionManager()
        self.users_file = USERS_FILE
        self._users: dict = {}  # {username: {hash, role}}
        self._load_users()

    def _hash(self, password: str) -> str:
        return hashlib.sha256(password.encode()).hexdigest()

    def _load_users(self):
        if not os.path.exists(self.users_file):
            return
        try:
            temp = self.users_file + ".tmp"
            self.encryption.decrypt_file(self.users_file, temp)
            with open(temp, "r") as f:
                data = json.load(f)
            os.remove(temp)
            # Migrate old single-admin format
            if "admin_hash" in data and "users" not in data:
                self._users = {"admin": {"hash": data["admin_hash"], "role": "admin"}}
                self._save_users()
            else:
                self._users = data.get("users", {})
            # Normalize all stored usernames to lowercase
            normalized = {k.lower(): v for k, v in self._users.items()}
            if normalized != self._users:
                self._users = normalized
                self._save_users()
        except Exception:
            pass

    def _save_users(self):
        temp = self.users_file + ".tmp"
        with open(temp, "w") as f:
            json.dump({"users": self._users}, f)
        self.encryption.encrypt_file(temp, self.users_file)
        os.remove(temp)

    # ── Queries ───────────────────────────────────────────────────────────────

    def is_configured(self) -> bool:
        return bool(self._users)

    def is_admin_configured(self) -> bool:
        return any(u["role"] == "admin" for u in self._users.values())

    def list_users(self) -> list[dict]:
        return [{"username": u, "role": d["role"]} for u, d in self._users.items()]

    def user_exists(self, username: str) -> bool:
        return username.lower() in self._users

    def get_role(self, username: str) -> str | None:
        user = self._users.get(username.lower())
        return user["role"] if user else None

    # ── Mutations ─────────────────────────────────────────────────────────────

    def create_user(self, username: str, password: str, role: str):
        self._users[username.lower()] = {"hash": self._hash(password), "role": role}
        self._save_users()

    def delete_user(self, username: str):
        self._users.pop(username.lower(), None)
        self._save_users()

    def change_password(self, username: str, new_password: str):
        key = username.lower()
        if key in self._users:
            self._users[key]["hash"] = self._hash(new_password)
            self._save_users()

    def update_user(self, username: str, new_username: str | None = None,
                    new_password: str | None = None, new_role: str | None = None) -> bool:
        key = username.lower()
        if key not in self._users:
            return False
        data = dict(self._users[key])
        if new_password:
            data["hash"] = self._hash(new_password)
        if new_role:
            data["role"] = new_role
        new_key = new_username.lower() if new_username else key
        if new_key != key:
            del self._users[key]
        self._users[new_key] = data
        self._save_users()
        return True

    # ── Verification ──────────────────────────────────────────────────────────

    def verify_user(self, username: str, password: str) -> str | None:
        """Return role on success, None on failure. Username lookup is case-insensitive."""
        user = self._users.get(username.lower())
        if user and user["hash"] == self._hash(password):
            return user["role"]
        return None

    # ── Backward-compat shims (used by existing /admin/setup flow) ────────────

    def set_admin_password(self, password: str):
        self.create_user("admin", password, "admin")

    def verify_admin_password(self, password: str) -> bool:
        return self.verify_user("admin", password) is not None


auth_manager = UserAuth()
