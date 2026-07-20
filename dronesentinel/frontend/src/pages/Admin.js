import React, { useState, useEffect } from "react";
import {
  Box, Grid, TextField, Button, Typography,
  Dialog, DialogTitle, DialogContent, DialogActions,
  List, ListItem, ListItemText, Chip,
  InputAdornment, IconButton
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import {
  getAdminStatus, setupAdmin, loginAdmin, changePassword,
  getEncryptedFiles, getAdminSettings, updateAdminSettings,
  getAuditLog, getDetectionSessions,
  saveTokens, clearTokens, isAuthenticated,
  takeSnapshot, exportCSV, exportJSON, exportPDF, exportHTML,
  getUsers, createUser, updateUser, deleteUser,
} from "../api";
import { PageHeader, SectionPanel } from "../components";

function StatusMessage({ msg }) {
  if (!msg) return null;
  const isOk = msg.type === "success";
  const color = isOk ? "#00e676" : "#ff3d3d";
  return (
    <Box sx={{
      mb: 2, px: 2, py: 1.5,
      bgcolor: `${color}0a`,
      border: `1px solid ${color}25`,
      borderLeft: `3px solid ${color}`,
      boxShadow: `inset 0 0 16px ${color}06`,
    }}>
      <Typography sx={{
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: "0.78rem",
        color,
        textShadow: `0 0 10px ${color}40`,
      }}>
        {isOk ? "✓" : "✗"}  {msg.text}
      </Typography>
    </Box>
  );
}

const fieldSx = {
  mb: 1.5,
  "& .MuiInputBase-root": { fontFamily: '"IBM Plex Mono", monospace', fontSize: "0.82rem" },
  "& .MuiInputLabel-root": { fontFamily: '"IBM Plex Mono", monospace', fontSize: "0.8rem" },
};

const monoSx = { fontFamily: '"IBM Plex Mono", monospace' };

const _USERNAME_RE = /^[a-zA-Z0-9_.]{3,32}$/;
function validateUsername(u) {
  if (!_USERNAME_RE.test(u)) return "3–32 characters: letters, digits, '_' and '.' only";
  if (u.startsWith('.') || u.endsWith('.')) return "Cannot start or end with a period";
  if (u.includes('..')) return "Cannot contain consecutive periods";
  return null;
}

export function getPwdChecks(pwd) {
  return [
    { label: "At least 8 characters",    ok: pwd.length >= 8 },
    { label: "Uppercase letter (A–Z)",    ok: /[A-Z]/.test(pwd) },
    { label: "Lowercase letter (a–z)",    ok: /[a-z]/.test(pwd) },
    { label: "Number (0–9)",              ok: /\d/.test(pwd) },
    { label: "Special character (!@#$…)", ok: /[^a-zA-Z0-9]/.test(pwd) },
  ];
}

function PwdChecklist({ pwd }) {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", mt: 0.5 }}>
      {getPwdChecks(pwd).map(({ label, ok }) => (
        <Box key={label} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ fontSize: "0.6rem", color: ok ? "#00e676" : "#3a4555", lineHeight: 1 }}>
            {ok ? "✓" : "○"}
          </Box>
          <Typography sx={{ ...monoSx, fontSize: "0.6rem", color: ok ? "#00e67699" : "#3a4555" }}>
            {label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export default function Admin() {
  const [configured, setConfigured] = useState(false);
  const [authed, setAuthed]         = useState(false);
  const [pwd, setPwd]               = useState("");
  const [msg, setMsg]               = useState(null);
  const [files, setFiles]           = useState([]);
  const [settings, setSettings]     = useState({});
  const [changeDlg, setChangeDlg]   = useState(false);
  const [curPwd, setCurPwd]         = useState("");
  const [newPwd, setNewPwd]         = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [dlgError, setDlgError]     = useState("");
  const [showPwd, setShowPwd]       = useState(false);
  const [showCurPwd, setShowCurPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [auditEntries, setAuditEntries]   = useState([]);
  const [auditFilter, setAuditFilter]     = useState("");
  const [auditDateFrom, setAuditDateFrom] = useState("");
  const [auditDateTo, setAuditDateTo]     = useState("");
  const [sessions, setSessions]           = useState([]);
  const [showAudit, setShowAudit]         = useState(false);
  const [showSessions, setShowSessions]   = useState(false);
  const [showSettingsPwd, setShowSettingsPwd] = useState(false);
  const [snapshot, setSnapshot]           = useState(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  // ── User management state ─────────────────────────────────────────────────
  const [users, setUsers]               = useState([]);
  const [userDlg, setUserDlg]           = useState(false);
  const [newUsername, setNewUsername]   = useState("");
  const [newUserPwd, setNewUserPwd]     = useState("");
  const [showNewUserPwd, setShowNewUserPwd] = useState(false);
  const [newUserRole, setNewUserRole]   = useState("operator");
  const [userDlgError, setUserDlgError] = useState("");
  const [deletingUser, setDeletingUser] = useState(null);
  const [userMsg, setUserMsg]           = useState(null);
  // Edit user dialog
  const [editingUser, setEditingUser]   = useState(null); // original username
  const [editUsername, setEditUsername] = useState("");
  const [editPwd, setEditPwd]           = useState("");
  const [showEditPwd, setShowEditPwd]   = useState(false);
  const [editRole, setEditRole]         = useState("operator");
  const [editDlgError, setEditDlgError] = useState("");

  // Check for existing valid token on mount — persists auth across page refresh
  useEffect(() => {
    getAdminStatus().then(({ data }) => {
      setConfigured(data.configured);
      if (isAuthenticated()) setAuthed(true);
    });
  }, []);

  useEffect(() => {
    if (authed) {
      getEncryptedFiles().then(({ data }) => setFiles(data.files || []));
      getAdminSettings().then(({ data }) => setSettings(data));
      getUsers().then(({ data }) => setUsers(data.users || [])).catch(() => {});
    }
  }, [authed]);

  const handleLoadUsers = () =>
    getUsers().then(({ data }) => setUsers(data.users || [])).catch(() => {});

  const handleCreateUser = async () => {
    setUserDlgError("");
    const uname = newUsername.trim().toLowerCase();
    if (!uname) { setUserDlgError("Username is required"); return; }
    const unameErr = validateUsername(uname);
    if (unameErr) { setUserDlgError(unameErr); return; }
    const pwdFailing = getPwdChecks(newUserPwd).filter(c => !c.ok);
    if (pwdFailing.length > 0) { setUserDlgError("Password does not meet all requirements below"); return; }
    try {
      await createUser(uname, newUserPwd, newUserRole);
      setUserMsg({ type: "success", text: `User '${uname}' created` });
      setUserDlg(false);
      setNewUsername(""); setNewUserPwd(""); setNewUserRole("operator"); setShowNewUserPwd(false);
      handleLoadUsers();
    } catch (e) {
      setUserDlgError(e.response?.data?.detail || "Failed to create user");
    }
  };

  const openEditDlg = (u) => {
    setEditingUser(u.username);
    setEditUsername(u.username);
    setEditPwd("");
    setShowEditPwd(false);
    setEditRole(u.role);
    setEditDlgError("");
  };

  const handleEditUser = async () => {
    setEditDlgError("");
    const newUname = editUsername.trim().toLowerCase();
    if (!newUname) { setEditDlgError("Username cannot be empty"); return; }
    const unameErr = validateUsername(newUname);
    if (unameErr) { setEditDlgError(unameErr); return; }
    if (editPwd) {
      const pwdFailing = getPwdChecks(editPwd).filter(c => !c.ok);
      if (pwdFailing.length > 0) { setEditDlgError("Password does not meet all requirements below"); return; }
    }
    const body = {};
    if (newUname !== editingUser.toLowerCase()) body.new_username = newUname;
    if (editPwd) body.new_password = editPwd;
    if (editRole !== users.find(u => u.username === editingUser)?.role) body.new_role = editRole;
    if (Object.keys(body).length === 0) { setEditDlgError("No changes made"); return; }
    try {
      await updateUser(editingUser, body);
      setUserMsg({ type: "success", text: `User '${editingUser}' updated` });
      setEditingUser(null);
      handleLoadUsers();
    } catch (e) {
      setEditDlgError(e.response?.data?.detail || "Failed to update user");
    }
  };

  const handleDeleteUser = async (username) => {
    try {
      await deleteUser(username);
      setUserMsg({ type: "success", text: `User '${username}' deleted` });
      setDeletingUser(null);
      handleLoadUsers();
    } catch (e) {
      setUserMsg({ type: "error", text: e.response?.data?.detail || "Delete failed" });
      setDeletingUser(null);
    }
  };

  const handleAuth = async () => {
    try {
      if (!configured) {
        await setupAdmin(pwd);
        setConfigured(true);
        setMsg({ type: "success", text: "Admin password set. Please log in." });
        return;
      }
      const { data } = await loginAdmin(pwd);
      // Store JWT tokens — persists auth across refresh
      saveTokens(data.access_token, data.refresh_token);
      setAuthed(true);
      setMsg({ type: "success", text: "Access granted" });
    } catch (e) {
      setMsg({ type: "error", text: e.response?.data?.detail || "Authentication failed" });
    }
  };

  const handleLogout = () => {
    clearTokens();
    setAuthed(false);
    setPwd("");
    setMsg(null);
  };

  const handleChangePassword = async () => {
    if (!curPwd)             { setDlgError("Current password is required."); return; }
    if (!newPwd)             { setDlgError("New password cannot be empty."); return; }
    if (newPwd.length < 4)  { setDlgError("New password must be at least 4 characters."); return; }
    if (newPwd !== confirmPwd) { setDlgError("New password and confirmation do not match."); return; }
    if (curPwd === newPwd)  { setDlgError("New password must be different from the current password."); return; }
    setDlgError("");
    try {
      await changePassword(curPwd, newPwd);
      setMsg({ type: "success", text: "Password updated successfully." });
      setChangeDlg(false);
      setCurPwd(""); setNewPwd(""); setConfirmPwd("");
    } catch (e) {
      setDlgError(e.response?.data?.detail || "Password change failed.");
    }
  };

  const handleSaveSettings = async () => {
    try {
      await updateAdminSettings(settings);
      setMsg({ type: "success", text: "Settings saved" });
    } catch (_) {
      setMsg({ type: "error", text: "Save failed" });
    }
  };

  const handleShowAudit = async () => {
    try {
      const { data } = await getAuditLog();
      setAuditEntries((data.entries || []).slice().reverse());
      setShowAudit(true);
    } catch (e) {
      setMsg({ type: "error", text: "Failed to load audit log" });
    }
  };

  const handleSnapshot = async () => {
    setSnapshotLoading(true);
    try {
      const { data } = await takeSnapshot();
      setSnapshot(data);
    } catch {
      setMsg({ type: "error", text: "Failed to take snapshot" });
    } finally {
      setSnapshotLoading(false);
    }
  };

  const handleShowSessions = async () => {
    try {
      const { data } = await getDetectionSessions(50);
      setSessions(data.sessions || []);
      setShowSessions(true);
    } catch (e) {
      setMsg({ type: "error", text: "Failed to load sessions" });
    }
  };

  /* ── Login / Setup screen ── */
  if (!authed) return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        icon="◆"
        title={configured ? "Admin Login" : "Initial Setup"}
        subtitle={configured ? "Authenticate to access admin panel" : "Configure administrator password"}
      />
      <Box sx={{ maxWidth: 380 }}>
        <StatusMessage msg={msg} />
        <SectionPanel title={configured ? "Authentication" : "Set Admin Password"}>
          <TextField
            label={configured ? "Admin Password" : "Set Password"}
            type={showPwd ? "text" : "password"} fullWidth size="small" sx={fieldSx}
            value={pwd} onChange={(e) => setPwd(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAuth()}
            InputLabelProps={{ shrink: true }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" edge="end"
                    onClick={() => setShowPwd(p => !p)}
                    sx={{ color: "#6e7a8a", "&:hover": { color: "#e6edf3" } }}>
                    {showPwd ? <VisibilityOff sx={{ fontSize: 16 }} /> : <Visibility sx={{ fontSize: 16 }} />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
          <Button
            variant="contained" fullWidth onClick={handleAuth}
            sx={{
              bgcolor: "#00d4ff", color: "#000", fontWeight: 700,
              py: 1.25,
              boxShadow: "0 0 20px #00d4ff30",
              "&:hover": { bgcolor: "#00b8d4", boxShadow: "0 0 28px #00d4ff50" },
            }}
          >
            {configured ? "→  Authenticate" : "→  Set Password"}
          </Button>
        </SectionPanel>
      </Box>
    </Box>
  );

  /* ── Admin Panel ── */
  return (
    <Box sx={{ p: 3, maxWidth: 1000 }}>
      <Box sx={{ mb: 1 }}>
        <PageHeader icon="◆" title="Admin Panel" subtitle="Security, data, and system configuration" />
      </Box>
      <StatusMessage msg={msg} />

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={5}>

          {/* Security */}
          <SectionPanel title="Security">
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Button
                variant="outlined" fullWidth
                onClick={() => { setChangeDlg(true); setDlgError(""); setCurPwd(""); setNewPwd(""); setConfirmPwd(""); setShowCurPwd(false); setShowNewPwd(false); setShowConfirmPwd(false); }}
                sx={{
                  borderColor: "#1c2333", color: "#e6edf3",
                  justifyContent: "flex-start", px: 2, fontSize: "0.75rem",
                  "&:hover": { borderColor: "#00d4ff40", bgcolor: "#00d4ff08" },
                }}
              >
                ⟳  Change Admin Password
              </Button>
              <Button
                variant="outlined" fullWidth onClick={handleShowAudit}
                sx={{
                  borderColor: "#1c2333", color: "#e6edf3",
                  justifyContent: "flex-start", px: 2, fontSize: "0.75rem",
                  "&:hover": { borderColor: "#ff9d0040", bgcolor: "#ff9d0008" },
                }}
              >
                ⬡  View Audit Log
              </Button>
              <Button
                variant="outlined" fullWidth onClick={handleShowSessions}
                sx={{
                  borderColor: "#1c2333", color: "#e6edf3",
                  justifyContent: "flex-start", px: 2, fontSize: "0.75rem",
                  "&:hover": { borderColor: "#00e67640", bgcolor: "#00e67608" },
                }}
              >
                ⬡  Detection Sessions History
              </Button>
            </Box>
          </SectionPanel>

          {/* Export Data */}
          <SectionPanel title="Export Data">
            {/* Step 1: Take snapshot */}
            <Button
              variant="outlined" fullWidth
              onClick={handleSnapshot}
              disabled={snapshotLoading}
              sx={{
                borderColor: "#00d4ff40", color: "#00d4ff",
                justifyContent: "flex-start", px: 2, fontSize: "0.75rem", mb: 1,
                "&:hover": { borderColor: "#00d4ff80", bgcolor: "#00d4ff0a" },
                "&.Mui-disabled": { borderColor: "#1c2333", color: "#4a5568" },
              }}
            >
              {snapshotLoading ? "…  Taking Snapshot" : "◎  Lock Snapshot"}
            </Button>

            {/* Snapshot status line */}
            {snapshot && (
              <Box sx={{
                mb: 1.5, px: 1.5, py: 1,
                bgcolor: "#00d4ff08", border: "1px solid #00d4ff20",
                borderLeft: "3px solid #00d4ff",
              }}>
                <Typography sx={{ ...monoSx, fontSize: "0.7rem", color: "#00d4ff" }}>
                  ✓ Snapshot at {snapshot.snapshot_at}
                </Typography>
                <Typography sx={{ ...monoSx, fontSize: "0.68rem", color: "#6e7a8a", mt: 0.25 }}>
                  {snapshot.total_frames?.toLocaleString()} frames · {snapshot.total_drones} drone(s) · {snapshot.duration} · {snapshot.avg_fps} fps
                </Typography>
              </Box>
            )}

            {/* Step 2: Download in any format — all use the locked snapshot */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
              {[
                { label: "Export CSV",  icon: "↓", action: exportCSV,  accent: "#00e676" },
                { label: "Export JSON", icon: "↓", action: exportJSON, accent: "#ffb300" },
                { label: "Export PDF",  icon: "↓", action: exportPDF,  accent: "#ff6b35" },
                { label: "Export HTML", icon: "↓", action: exportHTML, accent: "#00d4ff" },
              ].map(({ label, icon, action, accent }) => (
                <Button
                  key={label}
                  variant="outlined" fullWidth
                  onClick={action}
                  disabled={!snapshot}
                  sx={{
                    borderColor: "#1c2333", color: "#e6edf3",
                    justifyContent: "flex-start", px: 2, fontSize: "0.75rem",
                    "&:hover": { borderColor: `${accent}40`, bgcolor: `${accent}08`, color: accent },
                    "&.Mui-disabled": { borderColor: "#1c2333", color: "#4a5568" },
                  }}
                >
                  {icon}  {label}
                </Button>
              ))}
            </Box>
            {!snapshot && (
              <Typography sx={{ ...monoSx, fontSize: "0.68rem", color: "#4a5568", mt: 1 }}>
                Lock a snapshot first to enable exports.
              </Typography>
            )}
          </SectionPanel>

          {/* Encrypted files */}
          <SectionPanel title={`Encrypted Files  (${files.length})`}>
            {files.length === 0
              ? <Typography sx={{ ...monoSx, fontSize: "0.75rem", color: "#7d8590" }}>
                  No encrypted files found
                </Typography>
              : (
                <List dense disablePadding>
                  {files.map((f) => (
                    <ListItem key={f} disablePadding sx={{ py: 0.25 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box sx={{ color: "#00d4ff", fontSize: "0.65rem" }}>⬡</Box>
                        <Typography sx={{ ...monoSx, fontSize: "0.75rem", color: "#7d8590" }}>
                          {f}
                        </Typography>
                      </Box>
                    </ListItem>
                  ))}
                </List>
              )
            }
          </SectionPanel>
        </Grid>

        <Grid item xs={12} md={7}>
          {/* App Settings */}
          <SectionPanel title="Application Settings">
            {Object.entries(settings).map(([k, v]) => (
              k === "email_password" ? (
                <TextField
                  key={k} label={k} size="small" fullWidth sx={fieldSx}
                  type={showSettingsPwd ? "text" : "password"}
                  value={String(v)}
                  onChange={(e) => setSettings((p) => ({ ...p, [k]: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" edge="end"
                          onClick={() => setShowSettingsPwd(p => !p)}
                          sx={{ color: "#6e7a8a", "&:hover": { color: "#e6edf3" } }}>
                          {showSettingsPwd ? <VisibilityOff sx={{ fontSize: 16 }} /> : <Visibility sx={{ fontSize: 16 }} />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              ) : (
                <TextField
                  key={k} label={k} size="small" fullWidth sx={fieldSx}
                  value={String(v)}
                  onChange={(e) => setSettings((p) => ({ ...p, [k]: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                />
              )
            ))}
            {Object.keys(settings).length > 0 && (
              <Button
                variant="contained" onClick={handleSaveSettings}
                sx={{
                  bgcolor: "#00d4ff", color: "#000", fontWeight: 700, mt: 0.5,
                  "&:hover": { bgcolor: "#00b8d4" },
                }}
              >
                ✓  Save Settings
              </Button>
            )}
          </SectionPanel>
        </Grid>

        <Grid item xs={12}>
          <SectionPanel title="User Management" accentColor="#00d4ff">
            <StatusMessage msg={userMsg} />
            <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1.5 }}>
              <Button
                size="small"
                onClick={() => { setUserDlg(true); setUserDlgError(""); setNewUsername(""); setNewUserPwd(""); setNewUserRole("operator"); setShowNewUserPwd(false); }}
                sx={{
                  bgcolor: "#00d4ff15", color: "#00d4ff",
                  border: "1px solid #00d4ff30", fontSize: "0.72rem",
                  fontFamily: '"IBM Plex Mono", monospace',
                  "&:hover": { bgcolor: "#00d4ff25" },
                }}
              >
                + Add User
              </Button>
            </Box>

            {/* Users table header */}
            <Box sx={{
              display: "grid", gridTemplateColumns: "1fr 140px 110px 60px 65px",
              px: 1.5, py: 0.75, mb: 0.5,
              bgcolor: "#060a0e", borderBottom: "1px solid #1a2232",
            }}>
              {["Username", "Role", "Privileges", "", ""].map((h, i) => (
                <Typography key={i} sx={{ ...monoSx, fontSize: "0.62rem", color: "#3a4555", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                  {h}
                </Typography>
              ))}
            </Box>

            {users.length === 0
              ? <Typography sx={{ ...monoSx, fontSize: "0.75rem", color: "#4a5568", px: 1.5, py: 1 }}>No users found.</Typography>
              : users.map(u => {
                  const roleColor = { admin: "#ff6b35", operator: "#00d4ff", technical: "#00e676" }[u.role] || "#6e7a8a";
                  const privileges = { admin: "All tabs", operator: "Dashboard · Detection", technical: "Training · Troubleshooting" }[u.role] || "—";
                  const currentUser = localStorage.getItem("ds_username");
                  return (
                    <Box key={u.username} sx={{
                      display: "grid", gridTemplateColumns: "1fr 140px 110px 60px 65px",
                      px: 1.5, py: 1,
                      borderBottom: "1px solid #1a223240",
                      alignItems: "center",
                      "&:hover": { bgcolor: "#ffffff03" },
                    }}>
                      <Typography sx={{ ...monoSx, fontSize: "0.78rem", color: "#c9d1d9" }}>
                        {u.username}
                        {u.username === currentUser && (
                          <Typography component="span" sx={{ ...monoSx, fontSize: "0.6rem", color: "#6e7a8a", ml: 1 }}>(you)</Typography>
                        )}
                      </Typography>
                      <Chip label={u.role.toUpperCase()} size="small" sx={{
                        height: 18, fontSize: "0.6rem",
                        bgcolor: `${roleColor}12`, color: roleColor,
                        border: `1px solid ${roleColor}30`,
                        fontFamily: '"IBM Plex Mono", monospace',
                        width: "fit-content",
                      }} />
                      <Typography sx={{ ...monoSx, fontSize: "0.68rem", color: "#6e7a8a" }}>{privileges}</Typography>
                      <Button
                        size="small"
                        onClick={() => openEditDlg(u)}
                        sx={{
                          color: "#00d4ff80", fontSize: "0.68rem",
                          fontFamily: '"IBM Plex Mono", monospace',
                          minWidth: 0, px: 1,
                          "&:hover": { color: "#00d4ff", bgcolor: "#00d4ff10" },
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="small"
                        disabled={u.username === currentUser}
                        onClick={() => setDeletingUser(u.username)}
                        sx={{
                          color: "#ff3d3d80", fontSize: "0.68rem",
                          fontFamily: '"IBM Plex Mono", monospace',
                          minWidth: 0, px: 1,
                          "&:hover": { color: "#ff3d3d", bgcolor: "#ff3d3d10" },
                          "&.Mui-disabled": { color: "#3a4555" },
                        }}
                      >
                        Delete
                      </Button>
                    </Box>
                  );
                })
            }
          </SectionPanel>
        </Grid>

      </Grid>

      {/* ── Change Password Dialog ── */}
      <Dialog open={changeDlg} onClose={() => { setChangeDlg(false); setDlgError(""); }}
        PaperProps={{ sx: { bgcolor: "#0d1117", border: "1px solid #1c2333", minWidth: 340 } }}>
        <DialogTitle sx={{ ...monoSx, fontSize: "1rem", fontWeight: 600, borderBottom: "1px solid #1c2333", color: "#e6edf3", pb: 1.5 }}>
          Change Admin Password
        </DialogTitle>
        <DialogContent sx={{ pt: "16px !important", display: "flex", flexDirection: "column", gap: 1 }}>
          {dlgError && (
            <Box sx={{ px: 1.5, py: 1, bgcolor: "#ff3d3d10", border: "1px solid #ff3d3d40", borderLeft: "3px solid #ff3d3d", mb: 0.5 }}>
              <Typography sx={{ ...monoSx, fontSize: "0.75rem", color: "#ff3d3d" }}>✗  {dlgError}</Typography>
            </Box>
          )}
          <TextField label="Current Password" size="small" sx={fieldSx}
            type={showCurPwd ? "text" : "password"}
            value={curPwd} onChange={(e) => { setCurPwd(e.target.value); setDlgError(""); }}
            InputLabelProps={{ shrink: true }} autoFocus
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" edge="end"
                    onClick={() => setShowCurPwd(p => !p)}
                    sx={{ color: "#6e7a8a", "&:hover": { color: "#e6edf3" } }}>
                    {showCurPwd ? <VisibilityOff sx={{ fontSize: 16 }} /> : <Visibility sx={{ fontSize: 16 }} />}
                  </IconButton>
                </InputAdornment>
              )
            }} />
          <TextField label="New Password" size="small" sx={fieldSx}
            type={showNewPwd ? "text" : "password"}
            value={newPwd} onChange={(e) => { setNewPwd(e.target.value); setDlgError(""); }}
            InputLabelProps={{ shrink: true }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" edge="end"
                    onClick={() => setShowNewPwd(p => !p)}
                    sx={{ color: "#6e7a8a", "&:hover": { color: "#e6edf3" } }}>
                    {showNewPwd ? <VisibilityOff sx={{ fontSize: 16 }} /> : <Visibility sx={{ fontSize: 16 }} />}
                  </IconButton>
                </InputAdornment>
              )
            }} />
          <TextField label="Confirm New Password" size="small"
            type={showConfirmPwd ? "text" : "password"}
            sx={{ ...fieldSx, "& .MuiOutlinedInput-root fieldset": {
              borderColor: confirmPwd ? (confirmPwd === newPwd ? "#00e67660" : "#ff3d3d60") : undefined,
            }}}
            value={confirmPwd} onChange={(e) => { setConfirmPwd(e.target.value); setDlgError(""); }}
            InputLabelProps={{ shrink: true }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" edge="end"
                    onClick={() => setShowConfirmPwd(p => !p)}
                    sx={{ color: "#6e7a8a", "&:hover": { color: "#e6edf3" } }}>
                    {showConfirmPwd ? <VisibilityOff sx={{ fontSize: 16 }} /> : <Visibility sx={{ fontSize: 16 }} />}
                  </IconButton>
                </InputAdornment>
              )
            }}
            helperText={
              confirmPwd && confirmPwd !== newPwd
                ? <span style={{ color: "#ff3d3d", ...monoSx, fontSize: "0.7rem" }}>Passwords do not match</span>
                : confirmPwd && confirmPwd === newPwd
                ? <span style={{ color: "#00e676", ...monoSx, fontSize: "0.7rem" }}>✓ Passwords match</span>
                : ""
            } />
        </DialogContent>
        <DialogActions sx={{ borderTop: "1px solid #1c2333", px: 2.5, py: 1.5 }}>
          <Button onClick={() => setChangeDlg(false)} sx={{ color: "#7d8590", fontSize: "0.75rem" }}>Cancel</Button>
          <Button onClick={handleChangePassword} variant="contained"
            sx={{ bgcolor: "#00d4ff", color: "#000", fontWeight: 700, fontSize: "0.75rem", "&:hover": { bgcolor: "#00b8d4" } }}>
            Update Password
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Audit Log Dialog ── */}
      {(() => {
        const filteredAudit = auditEntries.filter(e => {
          const matchAction = !auditFilter || e.action.toLowerCase().includes(auditFilter.toLowerCase())
            || (e.details || "").toLowerCase().includes(auditFilter.toLowerCase());
          const ts = (e.timestamp || "").slice(0, 10);
          const matchFrom = !auditDateFrom || ts >= auditDateFrom;
          const matchTo   = !auditDateTo   || ts <= auditDateTo;
          return matchAction && matchFrom && matchTo;
        });
        return (
          <Dialog open={showAudit} onClose={() => setShowAudit(false)} maxWidth="md" fullWidth
            PaperProps={{ sx: { bgcolor: "#0d1117", border: "1px solid #1c2333" } }}>
            <DialogTitle sx={{ ...monoSx, fontSize: "1rem", fontWeight: 600, borderBottom: "1px solid #1c2333", color: "#e6edf3" }}>
              Audit Log  ({filteredAudit.length}{filteredAudit.length !== auditEntries.length ? `/${auditEntries.length}` : ""} entries)
            </DialogTitle>
            <DialogContent sx={{ pt: "12px !important" }}>
              {/* #9 — Filter controls */}
              <Box sx={{ display: "flex", gap: 1, mb: 1.5, flexWrap: "wrap", alignItems: "flex-end" }}>
                <TextField label="Filter event / details" size="small" value={auditFilter}
                  onChange={(e) => setAuditFilter(e.target.value)}
                  placeholder="LOGIN_FAILED, SETTINGS…"
                  InputLabelProps={{ shrink: true }}
                  sx={{ flex: 1, minWidth: 180, ...fieldSx }} />
                <TextField label="From date" size="small" type="date" value={auditDateFrom}
                  onChange={(e) => setAuditDateFrom(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ width: 155, ...fieldSx }} />
                <TextField label="To date" size="small" type="date" value={auditDateTo}
                  onChange={(e) => setAuditDateTo(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ width: 155, ...fieldSx }} />
                {(auditFilter || auditDateFrom || auditDateTo) && (
                  <Button size="small"
                    onClick={() => { setAuditFilter(""); setAuditDateFrom(""); setAuditDateTo(""); }}
                    sx={{ ...monoSx, fontSize: "0.7rem", color: "#7d8590", "&:hover": { color: "#e6edf3" } }}>
                    Clear
                  </Button>
                )}
              </Box>
              <Box sx={{ maxHeight: 380, overflowY: "auto" }}>
                {filteredAudit.length === 0
                  ? <Typography sx={{ ...monoSx, fontSize: "0.75rem", color: "#7d8590" }}>
                      {auditEntries.length === 0 ? "No entries yet." : "No entries match the current filter."}
                    </Typography>
                  : filteredAudit.map((e, i) => (
                    <Box key={i} sx={{ mb: 1, pb: 1, borderBottom: "1px solid #1c233340" }}>
                      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                        <Chip label={e.action} size="small"
                          sx={{ bgcolor: e.action.includes("FAILED") ? "#ff3d3d20" : "#00d4ff15",
                            color: e.action.includes("FAILED") ? "#ff3d3d" : "#00d4ff",
                            fontFamily: '"IBM Plex Mono"', fontSize: "0.68rem", height: 20 }} />
                        <Typography sx={{ ...monoSx, fontSize: "0.7rem", color: "#7d8590" }}>{e.timestamp}</Typography>
                        <Typography sx={{ ...monoSx, fontSize: "0.7rem", color: "#7d8590" }}>ip: {e.ip}</Typography>
                      </Box>
                      {e.details && (
                        <Typography sx={{ ...monoSx, fontSize: "0.7rem", color: "#e6edf380", mt: 0.25, ml: 0.5 }}>
                          {e.details}
                        </Typography>
                      )}
                    </Box>
                  ))
                }
              </Box>
            </DialogContent>
            <DialogActions sx={{ borderTop: "1px solid #1c2333" }}>
              <Button onClick={() => setShowAudit(false)} sx={{ color: "#7d8590" }}>Close</Button>
            </DialogActions>
          </Dialog>
        );
      })()}

      {/* ── Create User Dialog ── */}
      <Dialog open={userDlg} onClose={() => setUserDlg(false)}
        PaperProps={{ sx: { bgcolor: "#0d1117", border: "1px solid #1c2333", minWidth: 360 } }}>
        <DialogTitle sx={{ ...monoSx, fontSize: "1rem", fontWeight: 600, borderBottom: "1px solid #1c2333", color: "#e6edf3", pb: 1.5 }}>
          Add New User
        </DialogTitle>
        <DialogContent sx={{ pt: "16px !important", display: "flex", flexDirection: "column", gap: 1.5 }}>
          {userDlgError && (
            <Box sx={{ px: 1.5, py: 1, bgcolor: "#ff3d3d10", border: "1px solid #ff3d3d40", borderLeft: "3px solid #ff3d3d" }}>
              <Typography sx={{ ...monoSx, fontSize: "0.75rem", color: "#ff3d3d" }}>✗  {userDlgError}</Typography>
            </Box>
          )}
          <Box>
            <TextField label="Username" size="small" sx={fieldSx} autoFocus fullWidth
              value={newUsername} onChange={e => { setNewUsername(e.target.value); setUserDlgError(""); }}
              InputLabelProps={{ shrink: true }} />
            <Typography sx={{ ...monoSx, fontSize: "0.58rem", color: "#3a4555", mt: 0.5, lineHeight: 1.5 }}>
              3–32 chars · letters, digits, <code style={{ color: "#6e7a8a" }}>_</code> and <code style={{ color: "#6e7a8a" }}>.</code> only · case-insensitive
            </Typography>
          </Box>
          <Box>
            <TextField label="Password" size="small" sx={fieldSx} fullWidth
              type={showNewUserPwd ? "text" : "password"}
              value={newUserPwd} onChange={e => { setNewUserPwd(e.target.value); setUserDlgError(""); }}
              InputLabelProps={{ shrink: true }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowNewUserPwd(v => !v)}
                      sx={{ color: "#6e7a8a", "&:hover": { color: "#e6edf3" } }}>
                      {showNewUserPwd ? <VisibilityOff sx={{ fontSize: 16 }} /> : <Visibility sx={{ fontSize: 16 }} />}
                    </IconButton>
                  </InputAdornment>
                )
              }} />
            <PwdChecklist pwd={newUserPwd} />
          </Box>

          {/* Role selector */}
          <Box>
            <Typography sx={{ ...monoSx, fontSize: "0.65rem", color: "#6e7a8a", letterSpacing: "0.12em", textTransform: "uppercase", mb: 1 }}>
              Role
            </Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              {[
                { value: "operator",  label: "Operator",  color: "#00d4ff", desc: "Dashboard · Detection" },
                { value: "technical", label: "Technical", color: "#00e676", desc: "Training · Troubleshoot" },
                { value: "admin",     label: "Admin",     color: "#ff6b35", desc: "All tabs" },
              ].map(r => (
                <Box key={r.value}
                  onClick={() => setNewUserRole(r.value)}
                  sx={{
                    flex: 1, px: 1.5, py: 1, cursor: "pointer", borderRadius: 1,
                    border: `1px solid ${newUserRole === r.value ? r.color + "60" : "#1a2232"}`,
                    bgcolor: newUserRole === r.value ? `${r.color}10` : "transparent",
                    transition: "all 0.15s",
                    "&:hover": { borderColor: r.color + "40" },
                  }}>
                  <Typography sx={{ ...monoSx, fontSize: "0.7rem", color: newUserRole === r.value ? r.color : "#6e7a8a", fontWeight: 600 }}>
                    {r.label}
                  </Typography>
                  <Typography sx={{ ...monoSx, fontSize: "0.6rem", color: "#4a5568", mt: 0.25 }}>
                    {r.desc}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ borderTop: "1px solid #1c2333", px: 2.5, py: 1.5 }}>
          <Button onClick={() => setUserDlg(false)} sx={{ color: "#7d8590", fontSize: "0.75rem" }}>Cancel</Button>
          <Button onClick={handleCreateUser} variant="contained"
            sx={{ bgcolor: "#00d4ff", color: "#000", fontWeight: 700, fontSize: "0.75rem", "&:hover": { bgcolor: "#00b8d4" } }}>
            Create User
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit User Dialog ── */}
      <Dialog open={!!editingUser} onClose={() => setEditingUser(null)}
        PaperProps={{ sx: { bgcolor: "#0d1117", border: "1px solid #1c2333", minWidth: 380 } }}>
        <DialogTitle sx={{ ...monoSx, fontSize: "1rem", fontWeight: 600, borderBottom: "1px solid #1c2333", color: "#e6edf3", pb: 1.5 }}>
          Edit User — <span style={{ color: "#00d4ff" }}>{editingUser}</span>
        </DialogTitle>
        <DialogContent sx={{ pt: "16px !important", display: "flex", flexDirection: "column", gap: 1.5 }}>
          {editDlgError && (
            <Box sx={{ px: 1.5, py: 1, bgcolor: "#ff3d3d10", border: "1px solid #ff3d3d40", borderLeft: "3px solid #ff3d3d" }}>
              <Typography sx={{ ...monoSx, fontSize: "0.75rem", color: "#ff3d3d" }}>✗  {editDlgError}</Typography>
            </Box>
          )}

          {/* Username */}
          <Box>
            <TextField label="Username" size="small" sx={fieldSx} autoFocus fullWidth
              value={editUsername}
              onChange={e => { setEditUsername(e.target.value); setEditDlgError(""); }}
              InputLabelProps={{ shrink: true }} />
            <Typography sx={{ ...monoSx, fontSize: "0.58rem", color: "#3a4555", mt: 0.5, lineHeight: 1.5 }}>
              3–32 chars · letters, digits, <code style={{ color: "#6e7a8a" }}>_</code> and <code style={{ color: "#6e7a8a" }}>.</code> only · case-insensitive
            </Typography>
          </Box>

          {/* Password (optional) */}
          <Box>
            <TextField label="New Password" size="small" sx={fieldSx} fullWidth
              placeholder="Leave blank to keep current password"
              type={showEditPwd ? "text" : "password"}
              value={editPwd}
              onChange={e => { setEditPwd(e.target.value); setEditDlgError(""); }}
              InputLabelProps={{ shrink: true }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowEditPwd(v => !v)}
                      sx={{ color: "#6e7a8a", "&:hover": { color: "#e6edf3" } }}>
                      {showEditPwd ? <VisibilityOff sx={{ fontSize: 16 }} /> : <Visibility sx={{ fontSize: 16 }} />}
                    </IconButton>
                  </InputAdornment>
                )
              }} />
            {editPwd && <PwdChecklist pwd={editPwd} />}
          </Box>

          {/* Role */}
          <Box>
            <Typography sx={{ ...monoSx, fontSize: "0.65rem", color: "#6e7a8a", letterSpacing: "0.12em", textTransform: "uppercase", mb: 1 }}>
              Role
            </Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              {[
                { value: "operator",  label: "Operator",  color: "#00d4ff", desc: "Dashboard · Detection" },
                { value: "technical", label: "Technical", color: "#00e676", desc: "Training · Troubleshooting" },
                { value: "admin",     label: "Admin",     color: "#ff6b35", desc: "All tabs" },
              ].map(r => (
                <Box key={r.value}
                  onClick={() => setEditRole(r.value)}
                  sx={{
                    flex: 1, px: 1.5, py: 1, cursor: "pointer", borderRadius: 1,
                    border: `1px solid ${editRole === r.value ? r.color + "60" : "#1a2232"}`,
                    bgcolor: editRole === r.value ? `${r.color}10` : "transparent",
                    transition: "all 0.15s",
                    "&:hover": { borderColor: r.color + "40" },
                  }}>
                  <Typography sx={{ ...monoSx, fontSize: "0.7rem", color: editRole === r.value ? r.color : "#6e7a8a", fontWeight: 600 }}>
                    {r.label}
                  </Typography>
                  <Typography sx={{ ...monoSx, fontSize: "0.6rem", color: "#4a5568", mt: 0.25 }}>
                    {r.desc}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ borderTop: "1px solid #1c2333", px: 2.5, py: 1.5 }}>
          <Button onClick={() => setEditingUser(null)} sx={{ color: "#7d8590", fontSize: "0.75rem" }}>Cancel</Button>
          <Button onClick={handleEditUser} variant="contained"
            sx={{ bgcolor: "#00d4ff", color: "#000", fontWeight: 700, fontSize: "0.75rem", "&:hover": { bgcolor: "#00b8d4" } }}>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Confirm Dialog ── */}
      <Dialog open={!!deletingUser} onClose={() => setDeletingUser(null)}
        PaperProps={{ sx: { bgcolor: "#0d1117", border: "1px solid #1c2333", minWidth: 320 } }}>
        <DialogTitle sx={{ ...monoSx, fontSize: "1rem", fontWeight: 600, borderBottom: "1px solid #1c2333", color: "#e6edf3", pb: 1.5 }}>
          Confirm Delete
        </DialogTitle>
        <DialogContent sx={{ pt: "16px !important" }}>
          <Typography sx={{ ...monoSx, fontSize: "0.8rem", color: "#c9d1d9" }}>
            Delete user <span style={{ color: "#ff6b35" }}>'{deletingUser}'</span>? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ borderTop: "1px solid #1c2333", px: 2.5, py: 1.5 }}>
          <Button onClick={() => setDeletingUser(null)} sx={{ color: "#7d8590", fontSize: "0.75rem" }}>Cancel</Button>
          <Button onClick={() => handleDeleteUser(deletingUser)} variant="contained"
            sx={{ bgcolor: "#ff3d3d", color: "#fff", fontWeight: 700, fontSize: "0.75rem", "&:hover": { bgcolor: "#cc0000" } }}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Sessions Dialog ── */}
      <Dialog open={showSessions} onClose={() => setShowSessions(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { bgcolor: "#0d1117", border: "1px solid #1c2333" } }}>
        <DialogTitle sx={{ ...monoSx, fontSize: "1rem", fontWeight: 600, borderBottom: "1px solid #1c2333", color: "#e6edf3" }}>
          Detection Sessions  ({sessions.length})
        </DialogTitle>
        <DialogContent sx={{ pt: "12px !important", maxHeight: 450, overflowY: "auto" }}>
          {sessions.length === 0
            ? <Typography sx={{ ...monoSx, fontSize: "0.75rem", color: "#7d8590" }}>No sessions recorded yet.</Typography>
            : sessions.map((s) => (
              <Box key={s.id} sx={{ mb: 1.5, pb: 1.5, borderBottom: "1px solid #1c233340" }}>
                <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap", mb: 0.5 }}>
                  <Chip label={s.success ? "Success" : "Failed"} size="small"
                    sx={{ bgcolor: s.success ? "#00e67615" : "#ff3d3d20",
                      color: s.success ? "#00e676" : "#ff3d3d",
                      fontFamily: '"IBM Plex Mono"', fontSize: "0.68rem", height: 20 }} />
                  <Typography sx={{ ...monoSx, fontSize: "0.7rem", color: "#7d8590" }}>#{s.id}</Typography>
                  <Typography sx={{ ...monoSx, fontSize: "0.7rem", color: "#7d8590" }}>{s.start_time?.slice(0, 19)}</Typography>
                </Box>
                <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                  {[
                    ["Drones", s.total_drones],
                    ["Alerts", s.alerts_sent],
                    ["Frames", s.total_frames],
                    ["Avg Conf", s.avg_confidence?.toFixed(2)],
                  ].map(([label, val]) => (
                    <Box key={label}>
                      <Typography sx={{ ...monoSx, fontSize: "0.65rem", color: "#7d8590" }}>{label}</Typography>
                      <Typography sx={{ ...monoSx, fontSize: "0.78rem", color: "#e6edf3" }}>{val}</Typography>
                    </Box>
                  ))}
                </Box>
                {s.model && (
                  <Typography sx={{ ...monoSx, fontSize: "0.65rem", color: "#7d859080", mt: 0.5 }}>
                    model: {s.model.split(/[\\/]/).pop()}
                  </Typography>
                )}
              </Box>
            ))
          }
        </DialogContent>
        <DialogActions sx={{ borderTop: "1px solid #1c2333" }}>
          <Button onClick={() => setShowSessions(false)} sx={{ color: "#7d8590" }}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
