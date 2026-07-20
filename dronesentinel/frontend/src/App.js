import React from "react";
import logoImg from "./assets/logo.png";
import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate, useLocation } from "react-router-dom";
import {
  Box, AppBar, Toolbar, Typography, Drawer, List,
  ListItemButton, CssBaseline, Divider, Chip, IconButton, Tooltip,
} from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import theme from "./theme";

import { AuthProvider, useAuth } from "./AuthContext";

import Dashboard     from "./pages/Dashboard";
import Detection     from "./pages/Detection";
import Training      from "./pages/Training";
import Admin         from "./pages/Admin";
import UserGuide     from "./pages/UserGuide";
import Troubleshooting from "./pages/Troubleshooting";
import Login         from "./pages/Login";
import Forbidden     from "./pages/Forbidden";
import NotFound      from "./pages/NotFound";

// ── Role → allowed tabs ───────────────────────────────────────────────────────
const ALL_NAV = [
  { label: "Dashboard",    icon: "◈", path: "/",             roles: ["admin", "operator"] },
  { label: "Detection",    icon: "◉", path: "/detection",    roles: ["admin", "operator"] },
  { label: "Training",     icon: "◎", path: "/training",     roles: ["admin", "technical"] },
  { label: "Settings",       icon: "◆", path: "/settings",      roles: ["admin"] },
  { label: "Troubleshooting", icon: "⬡", path: "/troubleshooting", roles: ["admin", "technical"] },
  { label: "User Guide",   icon: "◷", path: "/guide",        roles: ["admin", "operator", "technical"] },
];

const ROLE_COLOR = { admin: "#ff6b35", operator: "#00d4ff", technical: "#00e676" };

const DRAWER_W = 220;

// ── Protected route ────────────────────────────────────────────────────────────
function PrivateRoute({ children, roles }) {
  const { auth } = useAuth();
  const location = useLocation();
  if (!auth) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(auth.role)) {
    return <Forbidden />;
  }
  return children;
}

// ── Main shell (shown when authenticated) ─────────────────────────────────────
function Shell() {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();

  const nav = ALL_NAV.filter(item => item.roles.includes(auth?.role));
  const defaultPath = nav[0]?.path ?? "/login";

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <Box sx={{ display: "flex", bgcolor: "#060a0e", minHeight: "100vh" }}>

      {/* Top bar */}
      <AppBar position="fixed" elevation={0} sx={{
        zIndex: 1300,
        bgcolor: "#060a0e",
        borderBottom: "1px solid #1a2232",
        height: 52,
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0, left: 0, right: 0, height: "1px",
          pointerEvents: "none",
          background: "linear-gradient(90deg, transparent 0%, #00d4ff50 30%, #00d4ff80 50%, #00d4ff50 70%, transparent 100%)",
        },
      }}>
        <Toolbar sx={{ minHeight: "52px !important", gap: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              component="img" src={logoImg} alt="DroneSentinel Logo"
              sx={{
                width: 32, height: 32, borderRadius: "50%",
                objectFit: "cover", objectPosition: "center",
                border: "1px solid #00d4ff40",
                boxShadow: "0 0 12px #00d4ff50, 0 0 24px #00d4ff20",
                flexShrink: 0,
              }}
            />
            <Typography sx={{
              fontFamily: '"IBM Plex Sans", sans-serif',
              fontWeight: 700, fontSize: "0.95rem",
              letterSpacing: "0.2em", textTransform: "uppercase",
              color: "#e6edf3", textShadow: "0 0 20px #00d4ff30",
            }}>
              DroneSentinel
            </Typography>
            <Chip label="v2.0" size="small" sx={{
              height: 18, fontSize: "0.62rem",
              bgcolor: "#00d4ff12", color: "#00d4ff",
              border: "1px solid #00d4ff35",
              fontFamily: '"IBM Plex Mono", monospace', letterSpacing: "0.05em",
            }} />
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {/* User badge + logout */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box sx={{
              width: 6, height: 6, borderRadius: "50%", bgcolor: "#00e676",
              boxShadow: "0 0 8px #00e676",
              animation: "hbPulse 3s infinite ease-in-out",
              "@keyframes hbPulse": { "0%,100%": { opacity: 1 }, "50%": { opacity: 0.3 } },
            }} />
            <Typography sx={{
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: "0.68rem", color: "#6e7a8a", letterSpacing: "0.1em",
            }}>
              AI DRONE DETECTION PLATFORM
            </Typography>

            {auth && (
              <>
                <Divider orientation="vertical" flexItem sx={{ borderColor: "#1a2232", mx: 0.5 }} />
                <Chip
                  label={auth.role.toUpperCase()}
                  size="small"
                  sx={{
                    height: 18, fontSize: "0.58rem",
                    bgcolor: `${ROLE_COLOR[auth.role]}12`,
                    color: ROLE_COLOR[auth.role],
                    border: `1px solid ${ROLE_COLOR[auth.role]}30`,
                    fontFamily: '"IBM Plex Mono", monospace',
                  }}
                />
                <Typography sx={{
                  fontFamily: '"IBM Plex Mono", monospace',
                  fontSize: "0.68rem", color: "#c9d1d9",
                }}>
                  {auth.username}
                </Typography>
                <Tooltip title="Sign out">
                  <IconButton
                    size="small" onClick={handleLogout}
                    sx={{
                      color: "#6e7a8a", fontSize: "0.75rem",
                      fontFamily: '"IBM Plex Mono", monospace',
                      px: 1, borderRadius: 1,
                      border: "1px solid #1a2232",
                      "&:hover": { color: "#ff6b6b", borderColor: "#ff3d3d40", bgcolor: "#ff3d3d08" },
                    }}
                  >
                    ⏻
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Side drawer */}
      <Drawer variant="permanent" sx={{
        width: DRAWER_W, flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: DRAWER_W, boxSizing: "border-box",
          bgcolor: "#060a0e", borderRight: "1px solid #1a2232",
          mt: "52px", pt: 2,
          "&::after": {
            content: '""', position: "absolute",
            top: 0, right: 0, width: "1px", height: "100%",
            pointerEvents: "none",
            background: "linear-gradient(180deg, #00d4ff20 0%, transparent 40%, transparent 60%, #00d4ff10 100%)",
          },
        },
      }}>
        <Box sx={{ px: 2, pb: 1.5 }}>
          <Typography sx={{
            fontFamily: '"IBM Plex Mono", monospace', fontSize: "0.6rem",
            color: "#3a4555", letterSpacing: "0.2em", textTransform: "uppercase",
          }}>
            Navigation
          </Typography>
        </Box>
        <List dense disablePadding>
          {nav.map(({ label, icon, path }) => (
            <ListItemButton
              key={path}
              component={NavLink}
              to={path}
              end={path === "/"}
              sx={{
                mx: 1, mb: 0.5, px: 1.5, py: 1, borderRadius: 1, gap: 1.5,
                color: "#6e7a8a",
                fontFamily: '"IBM Plex Mono", monospace', fontSize: "0.78rem", letterSpacing: "0.04em",
                transition: "all 0.18s ease",
                "&:hover": { bgcolor: "#ffffff06", color: "#c9d1d9" },
                "&.active": {
                  bgcolor: "#00d4ff0e", color: "#00d4ff",
                  borderLeft: "2px solid #00d4ff", pl: "10px",
                  boxShadow: "inset 0 0 12px #00d4ff06",
                  "&::after": {
                    content: '""', position: "absolute",
                    right: 0, top: "20%", width: "2px", height: "60%",
                    pointerEvents: "none", bgcolor: "#00d4ff",
                    borderRadius: 1, boxShadow: "0 0 8px #00d4ff",
                  },
                },
              }}
            >
              <Box sx={{ fontSize: "0.75rem", color: "inherit", opacity: 0.8 }}>{icon}</Box>
              {label}
            </ListItemButton>
          ))}
        </List>

        <Divider sx={{ mx: 2, mt: 2.5, mb: 2.5, borderColor: "#1a2232" }} />

        <Box sx={{ px: 2 }}>
          <Typography sx={{
            fontFamily: '"IBM Plex Mono", monospace', fontSize: "0.6rem",
            color: "#3a4555", letterSpacing: "0.2em", textTransform: "uppercase", mb: 1.5,
          }}>
            System Status
          </Typography>
          {[
            { label: "YOLOv26", status: "READY",  color: "#00e676" },
            { label: "BoT-SORT", status: "READY", color: "#00e676" },
            { label: "AES-256",  status: "ACTIVE", color: "#00d4ff" },
          ].map(({ label, status, color }) => (
            <Box key={label} sx={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              mb: 1, px: 1, py: 0.6, borderRadius: 1,
              bgcolor: "#ffffff04", border: "1px solid #1a2232",
            }}>
              <Typography sx={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: "0.7rem", color: "#6e7a8a" }}>
                {label}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: color, boxShadow: `0 0 6px ${color}` }} />
                <Typography sx={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: "0.6rem", color, letterSpacing: "0.06em" }}>
                  {status}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Drawer>

      {/* Main content */}
      <Box component="main" sx={{
        flexGrow: 1, mt: "52px", ml: `${DRAWER_W}px`,
        minHeight: "calc(100vh - 52px)", bgcolor: "#080c10", position: "relative",
      }}>
        <Routes>
          <Route path="/" element={
            <PrivateRoute roles={["admin", "operator"]}><Dashboard /></PrivateRoute>
          } />
          <Route path="/detection" element={
            <PrivateRoute roles={["admin", "operator"]}><Detection /></PrivateRoute>
          } />
          <Route path="/training" element={
            <PrivateRoute roles={["admin", "technical"]}><Training /></PrivateRoute>
          } />
          <Route path="/settings" element={
            <PrivateRoute roles={["admin"]}><Admin /></PrivateRoute>
          } />
          <Route path="/troubleshooting" element={
            <PrivateRoute roles={["admin", "technical"]}><Troubleshooting /></PrivateRoute>
          } />
          <Route path="/guide" element={
            <PrivateRoute roles={["admin", "operator", "technical"]}><UserGuide /></PrivateRoute>
          } />
          {/* 404 for unknown paths */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Box>
    </Box>
  );
}

// ── Scroll to top on every route change ──────────────────────────────────────
function ScrollToTop() {
  const { pathname } = useLocation();
  React.useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={<AuthGate />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

function AuthGate() {
  const { auth } = useAuth();
  if (!auth) return <Navigate to="/login" replace />;
  return <Shell />;
}
