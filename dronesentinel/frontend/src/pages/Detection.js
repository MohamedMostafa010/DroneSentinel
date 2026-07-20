import React, { useState, useEffect, useRef } from "react";
import {
  Box, Grid, TextField, Button, Switch, FormControlLabel,
  Typography, Chip, Collapse, Tooltip, IconButton, InputAdornment
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { startDetection, stopDetection, switchDetectionSource, getDetectionStatus,
         previewSource, setDetectAnnotate, testSmtp, setEmailLive,
         getDetectionConfig } from "../api";
import { PageHeader, LogPanel, SectionPanel } from "../components";

const mono = { fontFamily: '"IBM Plex Mono",monospace' };

/* Pure field */
const Field = React.memo(({ label, value, onChange, type }) => (
  <TextField label={label} size="small" fullWidth sx={{ mb: 0 }}
    type={type || "text"} value={value ?? ""}
    onChange={onChange} InputLabelProps={{ shrink: true }}
    inputProps={{ autoComplete: "off" }} />
));

/* Field with toggle */
const ToggledField = React.memo(({ label, value, onChange, enabled, onToggle, type }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
    <Tooltip title={enabled ? "Remove from command" : "Add to command"} placement="left">
      <Switch size="small" checked={enabled} onChange={onToggle}
        sx={{ "& .MuiSwitch-switchBase.Mui-checked": { color: "#00d4ff" },
              "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: "#00d4ff40" },
              flexShrink: 0 }} />
    </Tooltip>
    <Box sx={{ flex: 1, opacity: enabled ? 1 : 0.35, transition: "opacity 0.2s" }}>
      <Field label={label} value={value} onChange={onChange} type={type} />
    </Box>
  </Box>
));

/* Editable command textarea */
function EditableCmd({ value, onChange, color = "#00e676", label = "Command" }) {
  return (
    <TextField label={label} multiline minRows={2} fullWidth size="small"
      value={value} onChange={(e) => onChange(e.target.value)}
      InputLabelProps={{ shrink: true }}
      inputProps={{ spellCheck: false }}
      sx={{
        "& .MuiInputBase-input": { ...mono, fontSize: "0.72rem", lineHeight: 1.7 },
        "& .MuiOutlinedInput-root": {
          "& fieldset": { borderColor: `${color}40` },
          "&:hover fieldset": { borderColor: `${color}80` },
          "&.Mui-focused fieldset": { borderColor: color },
        },
      }} />
  );
}

const DEFAULT = {
  model_path: "C:\\Users\\moham\\runs\\detect\\runs\\train\\dronesentinel_train_FiNaL\\weights\\best.engine",
  source: "0",
  confidence: 0.25, save_dir: "runs/detect",
  enable_email: false, smtp_server: "smtp.gmail.com",
  smtp_port: 587, email_sender: "", email_password: "",
  email_recipients: "", send_summary_email: true, send_instant_alerts: false,
};

const OPTIONAL_DET_KEYS = ["confidence", "save_dir"];
const DEFAULT_DET_ENABLED = { confidence: true, save_dir: true };

/* ── Build detect command from fields ── */
function buildDetectCmd(c, en) {
  let cmd = `yolo detect predict model="${c.model_path || "<model.pt>"}" source=${c.source}`;
  if (en.confidence) cmd += ` conf=${c.confidence}`;
  if (en.save_dir)   cmd += ` project="${c.save_dir}"`;
  cmd += ` device=0`;
  if (!c.show_video) cmd += ` show=False`;
  return cmd;
}

/* ── Parse detect command back into fields ── */
function parseDetectCmd(cmd) {
  const get = (key) => {
    const m = cmd.match(new RegExp(`(?:^|\\s)${key}=("([^"]+)"|([^\\s]+))`));
    return m ? (m[2] ?? m[3]) : null;
  };
  const parsed = {};
  const newEnabled = { confidence: false, save_dir: false };
  if (get("model"))   parsed.model_path = get("model");
  if (get("source"))  parsed.source     = get("source");
  const conf = get("conf");
  if (conf !== null)  { parsed.confidence = conf; newEnabled.confidence = true; }
  const proj = get("project");
  if (proj !== null)  { parsed.save_dir  = proj; newEnabled.save_dir  = true; }
  if (/show=False/i.test(cmd)) parsed.show_video = false;
  else if (/show=True/i.test(cmd)) parsed.show_video = true;
  return { parsed, newEnabled };
}

// Module-level cache — survives React unmount/remount on tab navigation
let _running = false;
let _log = [];
let _alerts = [];
let _cfg = DEFAULT;
let _enabled = DEFAULT_DET_ENABLED;

export default function Detection() {
  // Initialize from module-level cache so state persists across navigation
  const [cfg, setCfg]         = useState(_cfg);
  const [enabled, setEnabled] = useState(_enabled);
  const [detectCmd, setDetectCmdRaw] = useState(() => buildDetectCmd(_cfg, _enabled));
  const [running, setRunning] = useState(_running);
  const [log, setLog]         = useState(_log);
  const [alerts, setAlerts]   = useState(_alerts);
  const [copied, setCopied]               = useState(false);
  const [showEmailPwd, setShowEmailPwd]   = useState(false);
  const [switching, setSwitching]         = useState(false);
  const [switchMsg, setSwitchMsg]         = useState("");
  const [previewing, setPreviewing]       = useState(false);
  const [previewImg, setPreviewImg]       = useState(null);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [smtpTesting, setSmtpTesting]     = useState(false);
  const [smtpTestMsg, setSmtpTestMsg]     = useState("");
  const logRef = useRef(null);

  /* Stable field handlers */
  const handlers = useRef({});
  Object.keys(DEFAULT).forEach((key) => {
    if (!handlers.current[key]) {
      handlers.current[key] = (e) => {
        const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
        setCfg(p => { const next = { ...p, [key]: val }; return next; });
      };
    }
  });
  // Override enable_email: also syncs to API when detection is running (#5)
  handlers.current.enable_email = (e) => {
    const val = e.target.checked;
    setCfg(p => ({ ...p, enable_email: val }));
    if (running) setEmailLive(val).catch(() => {});
  };
  const h = handlers.current;

  /* Stable toggle handlers */
  const toggleHandlers = useRef({});
  OPTIONAL_DET_KEYS.forEach((key) => {
    if (!toggleHandlers.current[key])
      toggleHandlers.current[key] = () => setEnabled(p => ({ ...p, [key]: !p[key] }));
  });
  const th = toggleHandlers.current;

  /* Keep module-level cache in sync so values survive navigation */
  useEffect(() => { _cfg = cfg; }, [cfg]);
  useEffect(() => { _enabled = enabled; }, [enabled]);

  /* On every mount, load saved config from settings.dat so Application Settings are always reflected */
  useEffect(() => {
    getDetectionConfig().then(({ data }) => {
      const merged = { ...DEFAULT, ...data };
      _cfg = merged;
      setCfg(merged);
    }).catch(() => {});
  }, []);

  /* Keep command in sync when fields/enabled change */
  useEffect(() => {
    setDetectCmdRaw(buildDetectCmd(cfg, enabled));
  }, [cfg, enabled]);

  /* Handle user editing command directly */
  const handleCmdChange = (val) => {
    setDetectCmdRaw(val);
    try {
      const { parsed, newEnabled } = parseDetectCmd(val);
      setCfg(p => ({ ...p, ...parsed }));
      setEnabled(p => ({ ...p, ...newEnabled }));
    } catch (_) {}
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(detectCmd);
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const { data } = await getDetectionStatus();
        // Update module-level cache so state survives navigation
        _running = data.running;
        _log = data.log || [];
        _alerts = data.alerts || [];
        setRunning(_running); setLog(_log); setAlerts(_alerts);
      } catch (_) {}
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log]);

  const handleStart = async () => {
    try {
      const payload = {
        ...cfg,
        confidence: enabled.confidence ? parseFloat(cfg.confidence) : null,
        save_dir:   enabled.save_dir   ? cfg.save_dir               : null,
      };
      await startDetection(payload); setRunning(true);
    } catch (e) { alert(e.response?.data?.detail || "Failed to start"); }
  };

  const handleStop = async () => { await stopDetection(); setRunning(false); };

  const handleSwitchSource = async () => {
    if (!cfg.source.trim()) return;
    setSwitching(true);
    setSwitchMsg("");
    try {
      await switchDetectionSource(cfg.source.trim());
      setSwitchMsg("↔ Switching…  watch the log below for confirmation.");
    } catch (e) {
      setSwitchMsg("⚠ " + (e.response?.data?.detail || "Switch failed"));
    } finally {
      setSwitching(false);
      setTimeout(() => setSwitchMsg(""), 4000);
    }
  };

  // #1 — source preview
  const handlePreview = async () => {
    if (!cfg.source.trim()) return;
    setPreviewing(true);
    setPreviewImg(null);
    try {
      const { data } = await previewSource(cfg.source.trim());
      setPreviewImg(data.image);
    } catch (e) {
      setSwitchMsg("⚠ Preview: " + (e.response?.data?.detail || "Cannot open source"));
      setTimeout(() => setSwitchMsg(""), 4000);
    } finally {
      setPreviewing(false);
    }
  };

  // #2 — annotation toggle
  const handleToggleAnnotate = async () => {
    const next = !showAnnotations;
    setShowAnnotations(next);
    try { await setDetectAnnotate(next); } catch (_) { setShowAnnotations(!next); }
  };

  // #4 — SMTP connection test
  const handleTestSmtp = async () => {
    setSmtpTesting(true);
    setSmtpTestMsg("");
    try {
      const { data } = await testSmtp({
        smtp_server:   cfg.smtp_server,
        smtp_port:     parseInt(cfg.smtp_port),
        email_sender:  cfg.email_sender,
        email_password: cfg.email_password,
      });
      setSmtpTestMsg("✓ " + data.message);
    } catch (e) {
      setSmtpTestMsg("⚠ " + (e.response?.data?.detail || "Connection failed"));
    } finally {
      setSmtpTesting(false);
      setTimeout(() => setSmtpTestMsg(""), 7000);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200 }}>
      <PageHeader icon="◉" title="Drone Detection" subtitle="YOLOv26 real-time drone tracking" />

      {/* Status bar */}
      <Box sx={{
        display: "flex", alignItems: "center", gap: 2, mb: 2.5, px: 2, py: 1.5,
        bgcolor: "#0b1018",
        border: "1px solid #1a2232",
        borderLeft: `3px solid ${running ? "#00e676" : "#1a2232"}`,
        boxShadow: running ? "inset 0 0 20px #00e67608" : "none",
        transition: "all 0.4s ease",
      }}>
        <Box sx={{
          width: 9, height: 9, borderRadius: "50%",
          bgcolor: running ? "#00e676" : "#2a3444",
          boxShadow: running ? "0 0 10px #00e676, 0 0 20px #00e67640" : "none",
          transition: "all 0.4s",
          animation: running ? "detPulse 1.8s infinite ease-in-out" : "none",
          "@keyframes detPulse": {
            "0%,100%": { boxShadow: "0 0 10px #00e676, 0 0 20px #00e67640" },
            "50%": { boxShadow: "0 0 4px #00e676, 0 0 8px #00e67620" },
          },
        }} />
        <Typography sx={{ ...mono, fontSize: "0.75rem", color: running ? "#00e676" : "#6e7a8a",
          letterSpacing: "0.12em", textTransform: "uppercase",
          textShadow: running ? "0 0 12px #00e67660" : "none",
        }}>
          {running ? "◉  Detection Active" : "◯  System Idle"}
        </Typography>
        {alerts.length > 0 && (
          <Chip label={`⚠ ${alerts.length} alerts`} size="small" sx={{ ml: "auto", height: 20,
            bgcolor: "#ff6b3518", color: "#ff6b35", border: "1px solid #ff6b3535",
            ...mono, fontSize: "0.62rem" }} />
        )}
      </Box>

      {/* ── Live Feed ── */}
      {running && (
        <Box sx={{
          mb: 2.5, bgcolor: "#020508",
          border: "1px solid #1a2232",
          borderTop: "2px solid #00e676",
          borderRadius: 1, overflow: "hidden",
          boxShadow: "0 0 40px #00e67610, 0 8px 32px #00000080",
        }}>
          {/* Feed header bar */}
          <Box sx={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            px: 2, py: 1.25, borderBottom: "1px solid #1a2232",
            background: "linear-gradient(90deg, #00e67606 0%, transparent 50%)",
          }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box sx={{
                width: 8, height: 8, borderRadius: "50%", bgcolor: "#00e676",
                boxShadow: "0 0 8px #00e676",
                animation: "livePulse 1.5s infinite ease-in-out",
                "@keyframes livePulse": {
                  "0%,100%": { transform: "scale(1)" },
                  "50%": { transform: "scale(0.7)", opacity: 0.5 },
                },
              }} />
              <Typography sx={{ ...mono, fontSize: "0.65rem", color: "#00e676",
                letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Live Detection Feed
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              {/* #2 — Annotation overlay toggle */}
              <Tooltip title={showAnnotations ? "Hide bounding boxes — show raw feed" : "Show bounding boxes and labels"} placement="top">
                <Button size="small" onClick={handleToggleAnnotate}
                  sx={{ ...mono, fontSize: "0.62rem", letterSpacing: "0.1em",
                    color: showAnnotations ? "#00e676" : "#6e7a8a",
                    borderColor: showAnnotations ? "#00e67640" : "#1a2232",
                    border: "1px solid", px: 1, py: 0.3, minWidth: 0,
                    "&:hover": { color: "#00e676", borderColor: "#00e67660" } }}>
                  {showAnnotations ? "◉ ANNOTATED" : "◯ RAW"}
                </Button>
              </Tooltip>
              <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#ff3d3d",
                boxShadow: "0 0 6px #ff3d3d",
                animation: "recPulse 1s infinite",
                "@keyframes recPulse": { "0%,100%": { opacity: 1 }, "50%": { opacity: 0.2 } },
              }} />
              <Typography sx={{ ...mono, fontSize: "0.62rem", color: "#ff3d3d", letterSpacing: "0.1em" }}>
                REC
              </Typography>
            </Box>
          </Box>
          {/* Stream */}
          <Box sx={{ position: "relative", width: "100%", bgcolor: "#000", lineHeight: 0 }}>
            <img
              key="stream-on"
              src={`http://localhost:8000/detection/stream?t=${Date.now()}`}
              alt="Live detection feed"
              style={{ width: "100%", display: "block", maxHeight: "70vh", objectFit: "contain" }}
            />
            {/* Corner HUD overlays */}
            {["topLeft","topRight","bottomLeft","bottomRight"].map((pos) => (
              <Box key={pos} sx={{
                position: "absolute",
                ...(pos.includes("top") ? { top: 12 } : { bottom: 12 }),
                ...(pos.includes("Left") ? { left: 12 } : { right: 12 }),
                width: 16, height: 16,
                borderTop: pos.includes("top") ? "2px solid #00e67680" : "none",
                borderBottom: pos.includes("bottom") ? "2px solid #00e67680" : "none",
                borderLeft: pos.includes("Left") ? "2px solid #00e67680" : "none",
                borderRight: pos.includes("Right") ? "2px solid #00e67680" : "none",
              }} />
            ))}
          </Box>
        </Box>
      )}

      {/* ── Config + Controls + Email — two columns below the feed ── */}
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={6}>
          <SectionPanel title="Detection Config">
            <Typography sx={{ ...mono, fontSize: "0.65rem", color: "#7d8590", mb: 1, letterSpacing: "0.05em" }}>
              Toggle the switch to include / exclude a parameter from the command
            </Typography>
            {/* #3 — Preset configurations */}
            <Box sx={{ display: "flex", gap: 0.75, mb: 1.5, flexWrap: "wrap" }}>
              {[
                { label: "Standard",          conf: 0.25 },
                { label: "High Sensitivity",  conf: 0.15 },
                { label: "Low-Light",         conf: 0.20 },
              ].map(p => (
                <Button key={p.label} size="small" variant="outlined"
                  onClick={() => setCfg(prev => ({ ...prev, confidence: p.conf }))}
                  sx={{ ...mono, fontSize: "0.62rem", py: 0.3, px: 1,
                    color: "#6e7a8a", borderColor: "#1c2333",
                    "&:hover": { borderColor: "#00d4ff40", color: "#00d4ff", bgcolor: "#00d4ff06" } }}>
                  {p.label}
                </Button>
              ))}
              <Typography sx={{ ...mono, fontSize: "0.6rem", color: "#3a4555", alignSelf: "center", ml: 0.5 }}>
                presets
              </Typography>
            </Box>
            <Box sx={{ mb: 1.5 }}><Field label="Model Path (.pt)" value={cfg.model_path} onChange={h.model_path} /></Box>
            <Box sx={{ mb: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                <Box sx={{ flex: 1 }}>
                  <Field label="Video Source (path, camera index, or RTSP URL)" value={cfg.source} onChange={h.source} />
                </Box>
                {/* #1 — Preview button (before starting detection) */}
                <Tooltip title={running ? "Detection running — see live feed" : "Grab a test frame to verify the source"} placement="top">
                  <span>
                    <Button variant="outlined" size="small"
                      onClick={handlePreview}
                      disabled={running || previewing || !cfg.source.trim()}
                      sx={{
                        ...mono, fontSize: "0.68rem", whiteSpace: "nowrap",
                        borderColor: "#ffb30040", color: "#ffb300",
                        height: 40, px: 1.5, flexShrink: 0,
                        "&:hover": { borderColor: "#ffb300", bgcolor: "#ffb3000a" },
                        "&.Mui-disabled": { borderColor: "#1a2232", color: "#3a4555" },
                      }}>
                      {previewing ? "…" : "▶ Preview"}
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip title={running ? "Switch to this source while detection is running" : "Start detection first"} placement="top">
                  <span>
                    <Button
                      variant="outlined" size="small"
                      onClick={handleSwitchSource}
                      disabled={!running || switching}
                      sx={{
                        ...mono, fontSize: "0.68rem", whiteSpace: "nowrap",
                        borderColor: "#00d4ff40", color: "#00d4ff",
                        height: 40, px: 1.5, flexShrink: 0,
                        "&:hover": { borderColor: "#00d4ff", bgcolor: "#00d4ff0a" },
                        "&.Mui-disabled": { borderColor: "#1a2232", color: "#3a4555" },
                      }}
                    >
                      {switching ? "…" : "↔ Switch"}
                    </Button>
                  </span>
                </Tooltip>
              </Box>
              {switchMsg && (
                <Typography sx={{
                  ...mono, fontSize: "0.65rem", mt: 0.5,
                  color: switchMsg.startsWith("⚠") ? "#ff6b35" : "#00d4ff",
                }}>
                  {switchMsg}
                </Typography>
              )}
              {/* #1 — Preview image */}
              {previewImg && (
                <Box sx={{ mt: 1, border: "1px solid #1a2232", borderRadius: 1, overflow: "hidden", position: "relative" }}>
                  <Box sx={{ position: "absolute", top: 4, left: 8, zIndex: 1,
                    bgcolor: "#0d111790", px: 0.8, py: 0.2, borderRadius: 0.5 }}>
                    <Typography sx={{ ...mono, fontSize: "0.58rem", color: "#ffb300" }}>▶ TEST FRAME</Typography>
                  </Box>
                  <img src={`data:image/jpeg;base64,${previewImg}`} alt="Source preview"
                    style={{ width: "100%", display: "block" }} />
                  <IconButton size="small" onClick={() => setPreviewImg(null)}
                    sx={{ position: "absolute", top: 2, right: 2, color: "#6e7a8a",
                      bgcolor: "#0d111790", "&:hover": { color: "#e6edf3" }, fontSize: "0.7rem", width: 20, height: 20 }}>
                    ✕
                  </IconButton>
                </Box>
              )}
            </Box>
            <ToggledField label="Confidence Threshold" value={cfg.confidence} onChange={h.confidence}
              enabled={enabled.confidence} onToggle={th.confidence} type="number" />
            <ToggledField label="Save Directory" value={cfg.save_dir} onChange={h.save_dir}
              enabled={enabled.save_dir} onToggle={th.save_dir} />
          </SectionPanel>

          {/* ── Editable Detect Command ── */}
          <SectionPanel title="YOLO Detect Command  ·  edit to sync fields">
            <Typography sx={{ ...mono, fontSize: "0.62rem", color: "#7d8590", mb: 1, letterSpacing: "0.04em" }}>
              Edit fields above → command updates automatically.  Edit the command directly → fields update automatically.
            </Typography>
            <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
              <Box sx={{ flex: 1 }}>
                <EditableCmd value={detectCmd} onChange={handleCmdChange} color="#00e676" label="yolo detect predict …" />
              </Box>
              <Tooltip title={copied ? "Copied!" : "Copy"} placement="top">
                <IconButton size="small" onClick={handleCopy}
                  sx={{ color: copied ? "#00e676" : "#7d8590", "&:hover": { color: "#e6edf3" }, flexShrink: 0 }}>
                  {copied ? "✓" : "⧉"}
                </IconButton>
              </Tooltip>
            </Box>
          </SectionPanel>

          {/* Start / Stop */}
          <Box sx={{ display: "flex", gap: 1.5, mt: 0.5 }}>
            <Button variant="contained" onClick={handleStart} disabled={running}
              sx={{
                bgcolor: "#00e676", color: "#000", fontWeight: 700,
                boxShadow: "0 0 20px #00e67640",
                "&:hover": { bgcolor: "#00c853", boxShadow: "0 0 28px #00e67660" },
                "&.Mui-disabled": { bgcolor: "#00e67618", color: "#6e7a8a", boxShadow: "none" },
                flex: 1, py: 1.25,
              }}>
              ▶  Start Detection
            </Button>
            <Button variant="contained" onClick={handleStop} disabled={!running}
              sx={{
                bgcolor: "#ff3d3d", color: "#fff", fontWeight: 700,
                boxShadow: "0 0 20px #ff3d3d40",
                "&:hover": { bgcolor: "#d32f2f", boxShadow: "0 0 28px #ff3d3d60" },
                "&.Mui-disabled": { bgcolor: "#ff3d3d18", color: "#6e7a8a", boxShadow: "none" },
                flex: 1, py: 1.25,
              }}>
              ■  Stop
            </Button>
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <SectionPanel title="Email Alerts">
            <FormControlLabel
              control={<Switch checked={cfg.enable_email} onChange={h.enable_email} size="small"
                sx={{ "& .MuiSwitch-switchBase.Mui-checked": { color: "#00d4ff" },
                  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: "#00d4ff40" } }} />}
              label={<Typography sx={{ ...mono, fontSize: "0.78rem", color: "#e6edf3" }}>Enable Email Notifications</Typography>}
              sx={{ mb: 1.5 }}
            />
            <Collapse in={cfg.enable_email}>
              <Box sx={{ mb: 1.5 }}><Field label="SMTP Server"  value={cfg.smtp_server}  onChange={h.smtp_server} /></Box>
              <Box sx={{ mb: 1.5 }}><Field label="SMTP Port"    value={cfg.smtp_port}    onChange={h.smtp_port} type="number" /></Box>
              <Box sx={{ mb: 1.5 }}><Field label="Sender Email" value={cfg.email_sender} onChange={h.email_sender} /></Box>
              <TextField label="Password" size="small" fullWidth sx={{ mb: 1.5 }}
                type={showEmailPwd ? "text" : "password"}
                value={cfg.email_password} onChange={h.email_password}
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" edge="end"
                        onClick={() => setShowEmailPwd(p => !p)}
                        sx={{ color: "#6e7a8a", "&:hover": { color: "#e6edf3" } }}>
                        {showEmailPwd ? <VisibilityOff sx={{ fontSize: 16 }} /> : <Visibility sx={{ fontSize: 16 }} />}
                      </IconButton>
                    </InputAdornment>
                  )
                }} />
              {/* #4 — SMTP test button */}
              <Box sx={{ mb: 1.5 }}>
                <Button size="small" variant="outlined"
                  onClick={handleTestSmtp}
                  disabled={smtpTesting || !cfg.smtp_server || !cfg.email_sender || !cfg.email_password}
                  sx={{ ...mono, fontSize: "0.7rem",
                    borderColor: smtpTestMsg.startsWith("✓") ? "#00e67640" : "#00d4ff40",
                    color: smtpTestMsg.startsWith("✓") ? "#00e676" : "#00d4ff",
                    "&:hover": { borderColor: "#00d4ff", bgcolor: "#00d4ff0a" },
                    "&.Mui-disabled": { borderColor: "#1a2232", color: "#3a4555" } }}>
                  {smtpTesting ? "Testing…" : "◌ Test SMTP Connection"}
                </Button>
                {smtpTestMsg && (
                  <Typography sx={{ ...mono, fontSize: "0.68rem", mt: 0.5,
                    color: smtpTestMsg.startsWith("✓") ? "#00e676" : "#ff6b35" }}>
                    {smtpTestMsg}
                  </Typography>
                )}
              </Box>
              <Box sx={{ mb: 1.5 }}><Field label="Recipients (comma-separated)" value={cfg.email_recipients} onChange={h.email_recipients} /></Box>
              <FormControlLabel
                control={<Switch checked={cfg.send_instant_alerts} onChange={h.send_instant_alerts} size="small" />}
                label={<Typography sx={{ ...mono, fontSize: "0.75rem", color: "#7d8590" }}>Instant Alerts</Typography>}
                sx={{ display: "flex", mb: 0.5 }} />
              <FormControlLabel
                control={<Switch checked={cfg.send_summary_email} onChange={h.send_summary_email} size="small" />}
                label={<Typography sx={{ ...mono, fontSize: "0.75rem", color: "#7d8590" }}>Session Summary Email</Typography>} />
            </Collapse>
          </SectionPanel>

          {alerts.length > 0 && (
            <SectionPanel title="Recent Alerts">
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                {alerts.slice(-5).map((a, i) => (
                  <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1.5,
                    px: 1.5, py: 0.75, bgcolor: "#ff6b3510",
                    border: "1px solid #ff6b3530", borderLeft: "2px solid #ff6b35" }}>
                    <Box sx={{ color: "#ff6b35", fontSize: "0.7rem" }}>⚠</Box>
                    <Typography sx={{ ...mono, fontSize: "0.72rem", color: "#e6edf3" }}>{a}</Typography>
                  </Box>
                ))}
              </Box>
            </SectionPanel>
          )}
        </Grid>
      </Grid>

      <Box sx={{ mt: 2.5 }}>
        <LogPanel lines={log} height={200} forwardRef={logRef} />
      </Box>
    </Box>
  );
}
