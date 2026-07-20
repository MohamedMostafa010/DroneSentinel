import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Typography, TextField, Button, CircularProgress, InputAdornment, IconButton } from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { useAuth } from "../AuthContext";
import { getAdminStatus, loginUser, setupAdmin } from "../api";
import { getPwdChecks } from "./Admin";
import logoImg from "../assets/logo.png";

const ROLE_HOME = { admin: "/", operator: "/", technical: "/training" };

export default function Login() {
  const { auth, login } = useAuth();
  const navigate = useNavigate();

  const [configured, setConfigured]   = useState(null); // null = loading
  const [username, setUsername]        = useState("");
  const [password, setPassword]        = useState("");
  const [setupPwd, setSetupPwd]        = useState("");
  const [setupPwd2, setSetupPwd2]      = useState("");
  const [error, setError]              = useState("");
  const [loading, setLoading]          = useState(false);
  const [showPwd, setShowPwd]          = useState(false);
  const [showSetupPwd, setShowSetupPwd]   = useState(false);
  const [showSetupPwd2, setShowSetupPwd2] = useState(false);

  // Already logged in → go to first allowed route for this role
  useEffect(() => {
    if (auth) navigate(ROLE_HOME[auth.role] ?? "/", { replace: true });
  }, [auth, navigate]);

  useEffect(() => {
    getAdminStatus()
      .then(({ data }) => setConfigured(data.configured))
      .catch(() => setConfigured(false));
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await loginUser(username, password);
      login(data.access_token, data.refresh_token, data.role, data.username);
      navigate(ROLE_HOME[data.role] ?? "/", { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async (e) => {
    e.preventDefault();
    setError("");
    if (setupPwd !== setupPwd2) { setError("Passwords do not match"); return; }
    const failing = getPwdChecks(setupPwd).filter(c => !c.ok);
    if (failing.length > 0) { setError("Password does not meet all requirements below"); return; }
    setLoading(true);
    try {
      await setupAdmin(setupPwd);
      setConfigured(true);
      setError("");
    } catch (err) {
      setError(err.response?.data?.detail || "Setup failed");
    } finally {
      setLoading(false);
    }
  };

  if (configured === null) return null;

  return (
    <Box sx={{
      minHeight: "100vh",
      bgcolor: "#060a0e",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Background grid */}
      <Box sx={{
        position: "absolute", inset: 0, opacity: 0.03,
        backgroundImage: "linear-gradient(#00d4ff 1px, transparent 1px), linear-gradient(90deg, #00d4ff 1px, transparent 1px)",
        backgroundSize: "40px 40px",
        pointerEvents: "none",
      }} />

      {/* Glow orb */}
      <Box sx={{
        position: "absolute",
        width: 400, height: 400,
        borderRadius: "50%",
        background: "radial-gradient(circle, #00d4ff08 0%, transparent 70%)",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
      }} />

      <Box sx={{
        position: "relative",
        width: "100%", maxWidth: 400,
        mx: 2,
        bgcolor: "#0b1018",
        border: "1px solid #1a2232",
        borderTop: "2px solid #00d4ff",
        p: 4,
        boxShadow: "0 0 60px #00d4ff08",
      }}>
        {/* Header */}
        <Box sx={{ textAlign: "center", mb: 4 }}>
          <Box
            component="img"
            src={logoImg}
            alt="DroneSentinel Logo"
            sx={{
              width: 72, height: 72,
              borderRadius: "50%",
              objectFit: "cover",
              objectPosition: "center",
              border: "2px solid #00d4ff40",
              boxShadow: "0 0 24px #00d4ff40, 0 0 48px #00d4ff15",
              mb: 2,
              display: "block",
              mx: "auto",
            }}
          />
          <Typography sx={{
            fontFamily: '"IBM Plex Sans", sans-serif',
            fontWeight: 700, fontSize: "1.15rem",
            letterSpacing: "0.18em", textTransform: "uppercase",
            color: "#e6edf3",
          }}>
            DroneSentinel
          </Typography>
          <Typography sx={{
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: "0.62rem", color: "#3a4555",
            letterSpacing: "0.2em", textTransform: "uppercase", mt: 0.5,
          }}>
            {configured ? "Secure Access" : "First-Time Setup"}
          </Typography>
        </Box>

        {configured ? (
          /* ── Login form ── */
          <Box component="form" onSubmit={handleLogin}>
            <Box sx={{ mb: 2 }}>
              <Typography sx={labelSx}>Username</Typography>
              <TextField
                fullWidth size="small" autoFocus
                value={username} onChange={e => setUsername(e.target.value)}
                placeholder="Enter username"
                sx={inputSx}
              />
            </Box>
            <Box sx={{ mb: 3 }}>
              <Typography sx={labelSx}>Password</Typography>
              <TextField
                fullWidth size="small" type={showPwd ? "text" : "password"}
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                sx={inputSx}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowPwd(v => !v)}
                        sx={{ color: "#3a4555", "&:hover": { color: "#6e7a8a" } }}>
                        {showPwd ? <VisibilityOff sx={{ fontSize: 16 }} /> : <Visibility sx={{ fontSize: 16 }} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            {error && <ErrorBox msg={error} />}

            <Button
              type="submit" fullWidth disabled={loading || !username || !password}
              sx={btnSx}
            >
              {loading ? <CircularProgress size={18} sx={{ color: "#060a0e" }} /> : "Sign In"}
            </Button>
          </Box>
        ) : (
          /* ── First-time admin setup ── */
          <Box component="form" onSubmit={handleSetup}>
            <Box sx={{
              px: 2, py: 1.5, mb: 3,
              bgcolor: "#00d4ff06", border: "1px solid #00d4ff20",
              borderLeft: "3px solid #00d4ff",
            }}>
              <Typography sx={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: "0.72rem", color: "#00d4ff99", lineHeight: 1.6 }}>
                No admin account found. Create one to get started.
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography sx={labelSx}>Admin Password</Typography>
              <TextField
                fullWidth size="small" type={showSetupPwd ? "text" : "password"} autoFocus
                value={setupPwd} onChange={e => setSetupPwd(e.target.value)}
                placeholder="Choose a strong password"
                sx={inputSx}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowSetupPwd(v => !v)}
                        sx={{ color: "#3a4555", "&:hover": { color: "#6e7a8a" } }}>
                        {showSetupPwd ? <VisibilityOff sx={{ fontSize: 16 }} /> : <Visibility sx={{ fontSize: 16 }} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              {/* Live password policy checklist */}
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", mt: 1 }}>
                {getPwdChecks(setupPwd).map(({ label, ok }) => (
                  <Box key={label} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Box sx={{ fontSize: "0.6rem", color: ok ? "#00e676" : "#3a4555", lineHeight: 1 }}>
                      {ok ? "✓" : "○"}
                    </Box>
                    <Typography sx={{
                      fontFamily: '"IBM Plex Mono", monospace',
                      fontSize: "0.6rem",
                      color: ok ? "#00e67699" : "#3a4555",
                    }}>
                      {label}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
            <Box sx={{ mb: 3 }}>
              <Typography sx={labelSx}>Confirm Password</Typography>
              <TextField
                fullWidth size="small" type={showSetupPwd2 ? "text" : "password"}
                value={setupPwd2} onChange={e => setSetupPwd2(e.target.value)}
                placeholder="Repeat password"
                sx={inputSx}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowSetupPwd2(v => !v)}
                        sx={{ color: "#3a4555", "&:hover": { color: "#6e7a8a" } }}>
                        {showSetupPwd2 ? <VisibilityOff sx={{ fontSize: 16 }} /> : <Visibility sx={{ fontSize: 16 }} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            {error && <ErrorBox msg={error} />}

            <Button
              type="submit" fullWidth disabled={loading || !setupPwd || !setupPwd2}
              sx={btnSx}
            >
              {loading ? <CircularProgress size={18} sx={{ color: "#060a0e" }} /> : "Create Admin Account"}
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ── Shared style tokens ────────────────────────────────────────────────────────

const labelSx = {
  fontFamily: '"IBM Plex Mono", monospace',
  fontSize: "0.65rem", color: "#6e7a8a",
  letterSpacing: "0.15em", textTransform: "uppercase",
  mb: 0.75,
};

const inputSx = {
  "& .MuiInputBase-root": {
    bgcolor: "#060a0e",
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: "0.82rem",
    color: "#e6edf3",
  },
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "#1a2232" },
  "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#2a3444" },
  "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#00d4ff50" },
  "& input::placeholder": { color: "#3a4555", opacity: 1 },
};

const btnSx = {
  bgcolor: "#00d4ff",
  color: "#060a0e",
  fontFamily: '"IBM Plex Mono", monospace',
  fontWeight: 700, fontSize: "0.78rem",
  letterSpacing: "0.15em", textTransform: "uppercase",
  py: 1.25,
  "&:hover": { bgcolor: "#00bfef" },
  "&:disabled": { bgcolor: "#1a2232", color: "#3a4555" },
};

function ErrorBox({ msg }) {
  return (
    <Box sx={{
      mb: 2, px: 2, py: 1,
      bgcolor: "#ff3d3d0a", border: "1px solid #ff3d3d25",
      borderLeft: "3px solid #ff3d3d",
    }}>
      <Typography sx={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: "0.72rem", color: "#ff6b6b" }}>
        {msg}
      </Typography>
    </Box>
  );
}
