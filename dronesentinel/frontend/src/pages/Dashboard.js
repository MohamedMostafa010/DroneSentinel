import React, { useEffect, useState } from "react";
import { Box, Grid, Paper, Button, Typography, Tooltip } from "@mui/material";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart
} from "recharts";
import { getMetrics, getDetectionStatus, exportCSV, exportJSON, exportPDF, exportHTML,
         getLastSession, getDetectionSessions } from "../api";
import { PageHeader, StatCard, SectionPanel } from "../components";

// Module-level cache — survives React unmount/remount on tab navigation
let _metrics = {};
let _fpsHistory = [];
let _detRunning = false;
let _lastSession = null;
let _sessions = [];

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{
      bgcolor: "#0b1018", border: "1px solid #1a2232",
      px: 1.5, py: 1,
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: "0.72rem", color: "#e6edf3",
      boxShadow: "0 8px 24px #00000080",
    }}>
      FPS: <span style={{ color: "#00d4ff", fontWeight: 700 }}>{payload[0].value?.toFixed(1)}</span>
    </Box>
  );
};

export default function Dashboard() {
  // Initialize from module-level cache so values survive navigation
  const [metrics, setMetrics]       = useState(_metrics);
  const [fpsHistory, setFpsHistory] = useState(_fpsHistory);
  const [detRunning, setDetRunning] = useState(_detRunning);
  const [lastSession, setLastSession] = useState(_lastSession);
  const [sessions, setSessions]     = useState(_sessions);
  const prevRunning = React.useRef(_detRunning);

  // Load session history on mount
  useEffect(() => {
    const load = async () => {
      try { const { data } = await getLastSession(); _lastSession = data.session; setLastSession(data.session); } catch (_) {}
      try { const { data } = await getDetectionSessions(10); _sessions = data.sessions || []; setSessions(data.sessions || []); } catch (_) {}
    };
    load();
  }, []);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        let m = {};
        let running = false;
        try { const { data } = await getMetrics(); m = data || {}; } catch (_) {}
        try {
          const { data: ds } = await getDetectionStatus();
          running = ds.running || false;
        } catch (_) {}

        // When detection is not running, zero out live metrics so stale values don't linger
        if (!running) {
          m = { ...m, active_drones: 0, fps: 0 };
        }

        // Refresh session history when detection just stopped
        if (!running && prevRunning.current) {
          try { const { data } = await getLastSession(); _lastSession = data.session; setLastSession(data.session); } catch (_) {}
          try { const { data } = await getDetectionSessions(10); _sessions = data.sessions || []; setSessions(data.sessions || []); } catch (_) {}
        }
        prevRunning.current = running;

        // Update module-level cache first
        _metrics = m;
        _detRunning = running;

        // Only accumulate FPS history while detection is actually running
        if (running && (m.fps ?? 0) > 0) {
          const next = [..._fpsHistory, { t: _fpsHistory.length, fps: m.fps }].slice(-80);
          _fpsHistory = next;
          setFpsHistory(next);
        }

        setMetrics(m);
        setDetRunning(running);
      } catch (_) {}
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const avgFps = fpsHistory.length
    ? (fpsHistory.reduce((s, d) => s + d.fps, 0) / fpsHistory.length).toFixed(1)
    : "0.0";

  const currentFps = (metrics.fps ?? 0).toFixed(1);
  const fpsColor = parseFloat(currentFps) >= 25 ? "#00e676" : parseFloat(currentFps) >= 10 ? "#ffb300" : "#ff3d3d";

  return (
    <Box sx={{ p: 3, maxWidth: 1200 }}>
      <PageHeader
        icon="◈"
        title="Analytics Dashboard"
        subtitle="Real-time detection metrics & export"
      />

      {/* Detection status banner */}
      <Box sx={{
        display: "flex", alignItems: "center", gap: 1.5, mb: 2.5, px: 2, py: 1.25,
        bgcolor: "#0b1018", border: "1px solid #1a2232",
        borderLeft: `3px solid ${detRunning ? "#00e676" : "#2a3444"}`,
      }}>
        <Box sx={{
          width: 8, height: 8, borderRadius: "50%",
          bgcolor: detRunning ? "#00e676" : "#2a3444",
          boxShadow: detRunning ? "0 0 8px #00e676, 0 0 16px #00e67640" : "none",
          animation: detRunning ? "dbPulse 1.8s infinite ease-in-out" : "none",
          "@keyframes dbPulse": {
            "0%,100%": { boxShadow: "0 0 8px #00e676, 0 0 16px #00e67640" },
            "50%": { boxShadow: "0 0 3px #00e676, 0 0 6px #00e67620" },
          },
        }} />
        <Typography sx={{
          fontFamily: '"IBM Plex Mono", monospace', fontSize: "0.72rem",
          color: detRunning ? "#00e676" : "#6e7a8a",
          letterSpacing: "0.12em", textTransform: "uppercase",
          textShadow: detRunning ? "0 0 10px #00e67660" : "none",
        }}>
          {detRunning ? "◉  Detection Active — metrics updating" : "◯  Detection not running — start detection to see live metrics"}
        </Typography>
      </Box>

      {/* Stat row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={4}>
          <StatCard label="Total Drones" value={metrics.total_drones ?? 0} accent="#00d4ff" />
        </Grid>
        <Grid item xs={6} sm={4}>
          <StatCard
            label="Avg Confidence"
            value={(metrics.avg_confidence ?? 0).toFixed(2)}
            accent="#ffb300"
          />
        </Grid>
        <Grid item xs={6} sm={4}>
          <StatCard label="Alerts Sent" value={metrics.alerts_sent ?? 0} accent="#ff6b35" />
        </Grid>
      </Grid>

      {/* #6 — Last Session summary (shown when not running and metrics are empty) */}
      {!detRunning && lastSession && (metrics.total_drones ?? 0) === 0 && (
        <Box sx={{ mb: 2.5, px: 2, py: 1.5, bgcolor: "#0b1018",
          border: "1px solid #1a2232", borderLeft: "3px solid #00d4ff" }}>
          <Typography sx={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: "0.65rem",
            color: "#6e7a8a", letterSpacing: "0.12em", textTransform: "uppercase", mb: 1 }}>
            Last Session Data
          </Typography>
          <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {[
              { label: "Drones",     value: lastSession.total_drones },
              { label: "Alerts",     value: lastSession.alerts_sent },
              { label: "Frames",     value: (lastSession.total_frames || 0).toLocaleString() },
              { label: "Confidence", value: (lastSession.avg_confidence || 0).toFixed(2) },
              { label: "Start",      value: lastSession.start_time ? lastSession.start_time.replace("T", " ").slice(0, 19) : "—" },
            ].map(({ label, value }) => (
              <Box key={label}>
                <Typography sx={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: "0.58rem", color: "#3a4555", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  {label}
                </Typography>
                <Typography sx={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: "0.85rem", color: "#00d4ff", fontWeight: 700 }}>
                  {value}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* FPS chart */}
      <Paper sx={{
        bgcolor: "#0b1018", border: "1px solid #1a2232",
        overflow: "hidden", mb: 2,
      }}>
        {/* Chart header */}
        <Box sx={{
          px: 2.5, py: 1.5,
          borderBottom: "1px solid #1a2232",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "linear-gradient(90deg, #0d1520 0%, #0b1018 100%)",
        }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Box sx={{
              display: "flex", alignItems: "center", gap: 1.5,
            }}>
              <Box sx={{ width: 3, height: 14, borderRadius: 1, bgcolor: "#00d4ff", boxShadow: "0 0 8px #00d4ff80" }} />
              <Typography sx={{
                fontFamily: '"IBM Plex Mono", monospace',
                fontSize: "0.68rem", color: "#6e7a8a",
                letterSpacing: "0.18em", textTransform: "uppercase",
              }}>
                FPS History
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
            <Box sx={{ textAlign: "right" }}>
              <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.58rem", color: "#6e7a8a", letterSpacing: "0.1em" }}>
                CURRENT
              </Typography>
              <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "1rem", fontWeight: 700, color: fpsColor, textShadow: `0 0 12px ${fpsColor}60` }}>
                {currentFps}
              </Typography>
            </Box>
            <Box sx={{ textAlign: "right" }}>
              <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.58rem", color: "#6e7a8a", letterSpacing: "0.1em" }}>
                AVG
              </Typography>
              <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "1rem", fontWeight: 700, color: "#00d4ff80" }}>
                {avgFps}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box sx={{ px: 2, pb: 2, pt: 1.5 }}>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={fpsHistory} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="fpsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00d4ff" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#00d4ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 6" stroke="#1a2232" vertical={false} />
              <XAxis dataKey="t" hide />
              <YAxis
                stroke="#6e7a8a"
                tick={{ fontFamily: '"IBM Plex Mono"', fontSize: 10, fill: "#6e7a8a" }}
                tickLine={false} axisLine={false}
              />
              <RTooltip content={<CustomTooltip />} />
              {parseFloat(avgFps) > 0 && (
                <ReferenceLine y={parseFloat(avgFps)} stroke="#00d4ff25" strokeDasharray="4 4" />
              )}
              <Area
                type="monotone" dataKey="fps"
                stroke="#00d4ff" strokeWidth={1.5}
                fill="url(#fpsGrad)"
                dot={false}
                activeDot={{ r: 4, fill: "#00d4ff", strokeWidth: 0, filter: "drop-shadow(0 0 4px #00d4ff)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
      </Paper>

      {/* Export */}
      <SectionPanel title="Export Session Data">
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
          {[
            { label: "Export CSV",  fn: exportCSV,  color: "#00e676", desc: "Comma-separated detections" },
            { label: "Export JSON", fn: exportJSON, color: "#00d4ff", desc: "Structured JSON data" },
            { label: "Export PDF",  fn: exportPDF,  color: "#ff6b35", desc: "Full session PDF report" },
            { label: "Export HTML", fn: exportHTML, color: "#a78bfa", desc: "Dark-themed HTML report" },
          ].map(({ label, fn, color, desc }) => (
            <Tooltip key={label} title={desc} placement="top">
              <Button
                variant="outlined"
                onClick={fn}
                sx={{
                  borderColor: `${color}30`,
                  color: color,
                  fontSize: "0.72rem",
                  px: 2.5, py: 1,
                  position: "relative", overflow: "hidden",
                  "&::before": {
                    content: '""',
                    position: "absolute", top: 0, left: "-100%",
                    width: "100%", height: "100%",
                    background: `linear-gradient(90deg, transparent, ${color}15, transparent)`,
                    transition: "left 0.4s ease",
                  },
                  "&:hover": {
                    borderColor: color,
                    bgcolor: `${color}08`,
                    boxShadow: `0 0 16px ${color}25`,
                    "&::before": { left: "100%" },
                  },
                }}
              >
                ↓ {label}
              </Button>
            </Tooltip>
          ))}
        </Box>
      </SectionPanel>

      {/* #7 — Detection Sessions History */}
      {sessions.length > 0 && (
        <SectionPanel title={`Detection Sessions History  (${sessions.length})`}>
          {/* Header */}
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 70px 65px 60px 70px 80px",
            px: 1.5, py: 0.75, bgcolor: "#060a0e", borderBottom: "1px solid #1a2232", mb: 0.5 }}>
            {["Start Time", "Status", "Drones", "Alerts", "Frames", "Confidence"].map(h => (
              <Typography key={h} sx={{ fontFamily: '"IBM Plex Mono",monospace',
                fontSize: "0.6rem", color: "#3a4555", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                {h}
              </Typography>
            ))}
          </Box>
          <Box sx={{ maxHeight: 280, overflowY: "auto" }}>
            {sessions.map(s => (
              <Box key={s.id} sx={{ display: "grid", gridTemplateColumns: "1fr 70px 65px 60px 70px 80px",
                px: 1.5, py: 0.9, borderBottom: "1px solid #1a223228",
                "&:hover": { bgcolor: "#ffffff03" }, alignItems: "center" }}>
                <Typography sx={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: "0.72rem", color: "#a5d6ff" }}>
                  {s.start_time ? s.start_time.replace("T", " ").slice(0, 16) : "—"}
                </Typography>
                <Typography sx={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: "0.68rem",
                  color: s.success ? "#00e676" : "#ff6b35", fontWeight: 600 }}>
                  {s.success ? "OK" : "FAILED"}
                </Typography>
                <Typography sx={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: "0.75rem", color: "#00d4ff", fontWeight: 700 }}>
                  {s.total_drones}
                </Typography>
                <Typography sx={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: "0.75rem", color: "#ff6b35" }}>
                  {s.alerts_sent}
                </Typography>
                <Typography sx={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: "0.72rem", color: "#7d8590" }}>
                  {(s.total_frames || 0).toLocaleString()}
                </Typography>
                <Typography sx={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: "0.72rem", color: "#ffb300" }}>
                  {(s.avg_confidence || 0).toFixed(3)}
                </Typography>
              </Box>
            ))}
          </Box>
        </SectionPanel>
      )}
    </Box>
  );
}
