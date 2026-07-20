import os
import tempfile

from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from ..models import PasswordChange, PasswordSet, AdminLogin, UserCreate, UserUpdate
from ..auth import auth_manager, create_access_token, create_refresh_token, verify_token, VALID_ROLES, validate_username, validate_password
from ..audit import audit_log
from ..database import get_sessions, get_session_drones
from ..encryption import EncryptionManager
from ..limiter import limiter
from ..settings import settings_manager
from ..utils.export import DataExportManager
from ..config import CONFIG_DIR

router = APIRouter(prefix="/admin", tags=["admin"])
encryption = EncryptionManager()
_bearer = HTTPBearer(auto_error=False)


# ── Auth dependencies ─────────────────────────────────────────────────────────

def require_auth(credentials: HTTPAuthorizationCredentials = Depends(_bearer)):
    """Any valid JWT — returns decoded payload (contains sub + role)."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = verify_token(credentials.credentials, token_type="access")
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload


def require_admin(payload: dict = Depends(require_auth)):
    """Restricts endpoint to admin role only."""
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return payload


def require_technical_or_admin(payload: dict = Depends(require_auth)):
    """Restricts endpoint to technical or admin roles."""
    if payload.get("role") not in ("admin", "technical"):
        raise HTTPException(status_code=403, detail="Technical or Admin access required")
    return payload


# ── Public endpoints ──────────────────────────────────────────────────────────

@router.get("/status")
def admin_status():
    return {"configured": auth_manager.is_admin_configured()}


@router.post("/setup")
def setup_admin(body: PasswordSet, request: Request):
    if auth_manager.is_admin_configured():
        raise HTTPException(status_code=400, detail="Admin already configured")
    pwd_err = validate_password(body.password)
    if pwd_err:
        raise HTTPException(status_code=400, detail=pwd_err)
    auth_manager.set_admin_password(body.password)
    audit_log.log("ADMIN_SETUP", "Admin account created", ip=request.client.host if request.client else "unknown")
    return {"status": "ok"}


@router.post("/login")
@limiter.limit("5/minute")
def login(request: Request, body: AdminLogin):
    """Rate-limited login — 5 attempts per minute per IP."""
    role = auth_manager.verify_user(body.username, body.password)
    if role is None:
        audit_log.log("LOGIN_FAILED", f"Invalid credentials for '{body.username}'",
                      ip=request.client.host if request.client else "unknown")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    access_token  = create_access_token(body.username, role)
    refresh_token = create_refresh_token(body.username, role)
    audit_log.log("LOGIN_SUCCESS", f"User '{body.username}' ({role}) logged in",
                  ip=request.client.host if request.client else "unknown")
    return {
        "status": "ok",
        "access_token":  access_token,
        "refresh_token": refresh_token,
        "token_type":    "bearer",
        "role":          role,
        "username":      body.username,
    }


@router.post("/refresh")
def refresh_token_endpoint(body: dict):
    """Exchange a valid refresh token for a new access token (preserves role)."""
    token = body.get("refresh_token", "")
    payload = verify_token(token, token_type="refresh")
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    new_access = create_access_token(
        subject=payload.get("sub", ""),
        role=payload.get("role", "admin"),
    )
    return {"access_token": new_access, "token_type": "bearer"}


# ── User management (admin only) ──────────────────────────────────────────────

@router.get("/users")
def list_users(_: dict = Depends(require_admin)):
    return {"users": auth_manager.list_users()}


@router.post("/users")
def create_user(body: UserCreate, request: Request, payload: dict = Depends(require_admin)):
    username = body.username.strip().lower()
    if not username or not body.password:
        raise HTTPException(status_code=400, detail="Username and password required")
    uname_err = validate_username(username)
    if uname_err:
        raise HTTPException(status_code=400, detail=uname_err)
    pwd_err = validate_password(body.password)
    if pwd_err:
        raise HTTPException(status_code=400, detail=pwd_err)
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Role must be one of {sorted(VALID_ROLES)}")
    if auth_manager.user_exists(username):
        raise HTTPException(status_code=409, detail="Username already exists")
    auth_manager.create_user(username, body.password, body.role)
    audit_log.log("USER_CREATED", f"User '{username}' ({body.role}) created by '{payload['sub']}'",
                  ip=request.client.host if request.client else "unknown")
    return {"status": "ok"}


@router.delete("/users/{username}")
def delete_user(username: str, request: Request, payload: dict = Depends(require_admin)):
    if username == payload.get("sub"):
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    if not auth_manager.user_exists(username):
        raise HTTPException(status_code=404, detail="User not found")
    auth_manager.delete_user(username)
    audit_log.log("USER_DELETED", f"User '{username}' deleted by '{payload['sub']}'",
                  ip=request.client.host if request.client else "unknown")
    return {"status": "ok"}


@router.put("/users/{username}")
def update_user(username: str, body: UserUpdate, request: Request, payload: dict = Depends(require_admin)):
    if not auth_manager.user_exists(username):
        raise HTTPException(status_code=404, detail="User not found")
    # Validate new username if provided
    if body.new_username is not None:
        new_uname = body.new_username.strip().lower()
        if not new_uname:
            raise HTTPException(status_code=400, detail="New username cannot be empty")
        uname_err = validate_username(new_uname)
        if uname_err:
            raise HTTPException(status_code=400, detail=uname_err)
        if new_uname != username.lower() and auth_manager.user_exists(new_uname):
            raise HTTPException(status_code=409, detail="Username already taken")
    else:
        new_uname = None
    # Validate new password if provided
    if body.new_password is not None and body.new_password != "":
        pwd_err = validate_password(body.new_password)
        if pwd_err:
            raise HTTPException(status_code=400, detail=pwd_err)
        new_pwd = body.new_password
    else:
        new_pwd = None
    # Validate new role if provided
    if body.new_role is not None and body.new_role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Role must be one of {sorted(VALID_ROLES)}")
    if not any([new_uname, new_pwd, body.new_role]):
        raise HTTPException(status_code=400, detail="Nothing to update")
    auth_manager.update_user(username, new_username=new_uname, new_password=new_pwd, new_role=body.new_role)
    audit_log.log("USER_UPDATED", f"User '{username}' updated by '{payload['sub']}'",
                  ip=request.client.host if request.client else "unknown")
    return {"status": "ok"}


# ── Protected endpoints (admin only) ─────────────────────────────────────────

@router.post("/change-password")
def change_password(body: PasswordChange, request: Request, payload: dict = Depends(require_admin)):
    username = payload.get("sub", "")
    if not auth_manager.verify_user(username, body.current_password):
        audit_log.log("PASSWORD_CHANGE_FAILED", "Wrong current password",
                      ip=request.client.host if request.client else "unknown")
        raise HTTPException(status_code=401, detail="Current password incorrect")
    pwd_err = validate_password(body.new_password)
    if pwd_err:
        raise HTTPException(status_code=400, detail=pwd_err)
    auth_manager.change_password(username, body.new_password)
    audit_log.log("PASSWORD_CHANGED", f"Password changed for '{username}'",
                  ip=request.client.host if request.client else "unknown")
    return {"status": "ok"}


@router.get("/encrypted-files")
def list_encrypted_files(_: dict = Depends(require_admin)):
    files = []
    if os.path.exists(CONFIG_DIR):
        for f in os.listdir(CONFIG_DIR):
            if f.endswith(".dat"):
                files.append(f"config/{f}")
    return {"files": files}


@router.post("/decrypt")
def decrypt_file(body: dict, _: dict = Depends(require_admin)):
    file_path = body.get("file_path", "")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".json")
    tmp.close()
    try:
        encryption.decrypt_file(file_path, tmp.name)
        return FileResponse(tmp.name, filename=os.path.basename(file_path) + ".decrypted")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export")
def export_all(request: Request, _: dict = Depends(require_admin)):
    audit_log.log("EXPORT", "Admin triggered PDF export",
                  ip=request.client.host if request.client else "unknown")
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    tmp.close()
    DataExportManager.to_pdf({}, tmp.name, "DroneSentinel Export")
    return FileResponse(tmp.name, media_type="application/pdf",
                        filename="dronesentinel_export.pdf")


@router.get("/settings")
def get_settings(_: dict = Depends(require_admin)):
    return settings_manager.all()


@router.put("/settings")
def update_settings(body: dict, request: Request, _: dict = Depends(require_admin)):
    settings_manager.update(body)
    audit_log.log("SETTINGS_UPDATED", f"Keys updated: {list(body.keys())}",
                  ip=request.client.host if request.client else "unknown")
    return {"status": "ok"}


@router.get("/audit-log")
def get_audit_log(_: dict = Depends(require_admin)):
    return {"entries": audit_log.get_all()}


@router.get("/sessions")
def get_detection_sessions(limit: int = 50, _: dict = Depends(require_auth)):
    return {"sessions": get_sessions(limit)}


@router.get("/sessions/{session_id}/drones")
def get_session_drone_records(session_id: int, _: dict = Depends(require_admin)):
    return {"drones": get_session_drones(session_id)}
