import React, { useState, useEffect, useRef } from "react";
import {
  Box, Typography, Chip, TextField, Button, LinearProgress, CircularProgress,
} from "@mui/material";
import { PageHeader, SectionPanel } from "../components";
import {
  systemCheck, pingCamera, startBenchmark, stopBenchmark, getBenchmarkStatus,
} from "../api";

/* ── tiny helpers ────────────────────────────────────────── */
function StatusChip({ ok, yes = "YES", no = "NO" }) {
  return (
    <Chip label={ok ? yes : no} size="small" sx={{
      height: 18, fontSize: "0.65rem",
      fontFamily: '"IBM Plex Mono", monospace',
      bgcolor: ok ? "#00e67615" : "#ff3d3d15",
      color: ok ? "#00e676" : "#ff3d3d",
      border: `1px solid ${ok ? "#00e67630" : "#ff3d3d30"}`,
    }} />
  );
}

function Row({ label, value, chip }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 0.7, borderBottom: "1px solid #1c233340" }}>
      <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.78rem", color: "#7d8590" }}>{label}</Typography>
      {chip !== undefined ? <StatusChip ok={chip} /> : (
        <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.78rem", color: "#e6edf3", fontWeight: 600 }}>{value ?? "—"}</Typography>
      )}
    </Box>
  );
}

function MetricBar({ label, ms, maxMs }) {
  const pct = Math.min((ms / maxMs) * 100, 100);
  const color = ms < 5 ? "#00e676" : ms < 20 ? "#00d4ff" : ms < 50 ? "#ffb300" : "#ff3d3d";
  return (
    <Box sx={{ mb: 1 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.3 }}>
        <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.72rem", color: "#7d8590" }}>{label}</Typography>
        <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.72rem", color, fontWeight: 600 }}>{ms.toFixed(1)} ms</Typography>
      </Box>
      <Box sx={{ height: 6, bgcolor: "#1c2333", borderRadius: 1, overflow: "hidden" }}>
        <Box sx={{ width: `${pct}%`, height: "100%", bgcolor: color, borderRadius: 1, transition: "width 0.4s ease" }} />
      </Box>
    </Box>
  );
}

// Module-level cache — survives React unmount/remount on tab navigation
let _sysInfo = null;
let _pingIp = "";
let _pingResult = null;
let _benchRtsp = "";
let _benchModel = "";
let _benchFrames = 60;
let _benchStatus = { running: false, stage: "", progress: 0, results: null, error: null };

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function Troubleshooting() {
  /* ── system check state ── */
  const [sysInfo, setSysInfo] = useState(_sysInfo);
  const [sysLoading, setSysLoading] = useState(_sysInfo === null);

  /* ── ping state ── */
  const [pingIp, setPingIp] = useState(_pingIp);
  const [pingResult, setPingResult] = useState(_pingResult);
  const [pinging, setPinging] = useState(false);

  /* ── benchmark state ── */
  const [benchRtsp, setBenchRtsp] = useState(_benchRtsp);
  const [benchModel, setBenchModel] = useState(_benchModel);
  const [benchFrames, setBenchFrames] = useState(_benchFrames);
  const [benchStatus, setBenchStatus] = useState(_benchStatus);
  const pollRef = useRef(null);

  // Sync state → module-level cache
  useEffect(() => { _sysInfo = sysInfo; }, [sysInfo]);
  useEffect(() => { _pingIp = pingIp; }, [pingIp]);
  useEffect(() => { _pingResult = pingResult; }, [pingResult]);
  useEffect(() => { _benchRtsp = benchRtsp; }, [benchRtsp]);
  useEffect(() => { _benchModel = benchModel; }, [benchModel]);
  useEffect(() => { _benchFrames = benchFrames; }, [benchFrames]);
  useEffect(() => { _benchStatus = benchStatus; }, [benchStatus]);

  /* ── auto-run system check on mount ── */
  useEffect(() => {
    setSysLoading(true);
    systemCheck()
      .then(({ data }) => setSysInfo(data))
      .catch(() => setSysInfo(null))
      .finally(() => setSysLoading(false));
  }, []);

  /* ── ping handler ── */
  const handlePing = async () => {
    if (!pingIp.trim()) return;
    setPinging(true); setPingResult(null);
    try {
      const { data } = await pingCamera(pingIp.trim());
      setPingResult(data);
    } catch { setPingResult({ ok: false, error: "Request failed" }); }
    finally { setPinging(false); }
  };

  /* ── benchmark handlers ── */
  const handleStartBench = async () => {
    if (!benchRtsp.trim()) return;
    setBenchStatus({ running: true, stage: "Starting...", progress: 0, results: null, error: null });
    try {
      await startBenchmark({ rtsp_url: benchRtsp.trim(), model_path: benchModel.trim(), num_frames: benchFrames });
      pollRef.current = setInterval(async () => {
        try {
          const { data } = await getBenchmarkStatus();
          setBenchStatus(data);
          if (!data.running) clearInterval(pollRef.current);
        } catch { /* ignore */ }
      }, 800);
    } catch { setBenchStatus(prev => ({ ...prev, running: false, error: "Failed to start" })); }
  };

  const handleStopBench = async () => {
    try { await stopBenchmark(); } catch { /* ignore */ }
    if (pollRef.current) clearInterval(pollRef.current);
    setBenchStatus(prev => ({ ...prev, running: false, stage: "Stopped" }));
  };

  useEffect(() => { return () => { if (pollRef.current) clearInterval(pollRef.current); }; }, []);

  const r = benchStatus.results;

  /* ═══ RENDER ═══ */
  return (
    <Box sx={{ p: 3, maxWidth: 900 }}>
      <PageHeader icon="◈" title="Troubleshooting" subtitle="System diagnostics · Network test · Pipeline benchmark" />

      {/* ═══ SYSTEM CHECK ═══ */}
      <SectionPanel title="System Check">
        {sysLoading ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <CircularProgress size={16} sx={{ color: "#00d4ff" }} />
            <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.78rem", color: "#7d8590" }}>Checking system...</Typography>
          </Box>
        ) : sysInfo ? (
          <Box>
            <Row label="Python" value={sysInfo.python} />
            <Row label="OpenCV" value={sysInfo.opencv} />
            <Row label="OpenCV CUDA" chip={sysInfo.opencv_cuda} />
            <Row label="CUDA Devices" value={sysInfo.cuda_devices} />
            <Row label="NVDEC (GPU Decode)" chip={sysInfo.nvdec} />
            <Row label="NVCUVID in Build" chip={sysInfo.nvcuvid_in_build} />
            <Row label="PyTorch" value={sysInfo.torch} />
            <Row label="PyTorch CUDA" chip={sysInfo.torch_cuda} />
            <Row label="GPU" value={sysInfo.gpu_name} />
            <Row label="CUDA Version" value={sysInfo.cuda_version} />
          </Box>
        ) : (
          <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.78rem", color: "#ff3d3d" }}>
            Could not connect to backend. Is uvicorn running?
          </Typography>
        )}
      </SectionPanel>

      {/* ═══ CAMERA PING ═══ */}
      <SectionPanel title="Camera Network Test">
        <Box sx={{ display: "flex", gap: 1.5, mb: 2, alignItems: "flex-end" }}>
          <TextField
            label="Camera IP Address"
            placeholder="192.168.100.127"
            value={pingIp}
            onChange={(e) => setPingIp(e.target.value)}
            size="small"
            sx={{ flex: 1, "& .MuiInputBase-root": { fontFamily: '"IBM Plex Mono"', fontSize: "0.82rem", bgcolor: "#0d1117", color: "#e6edf3" },
              "& .MuiInputLabel-root": { fontFamily: '"IBM Plex Mono"', fontSize: "0.78rem", color: "#7d8590" },
              "& .MuiOutlinedInput-notchedOutline": { borderColor: "#1c2333" },
            }}
            onKeyDown={(e) => { if (e.key === "Enter") handlePing(); }}
          />
          <Button onClick={handlePing} disabled={pinging || !pingIp.trim()} variant="outlined" size="small"
            sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.75rem", borderColor: "#00d4ff40", color: "#00d4ff",
              "&:hover": { borderColor: "#00d4ff", bgcolor: "#00d4ff10" }, minWidth: 90, height: 40 }}>
            {pinging ? "Pinging..." : "Ping"}
          </Button>
        </Box>
        {pingResult && (
          <Box sx={{ p: 2, bgcolor: "#0d1117", border: "1px solid #1c2333", borderRadius: 1 }}>
            {pingResult.ok ? (
              <>
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 1.5, mb: 1 }}>
                  {[
                    { l: "Avg", v: `${pingResult.avg} ms`, c: pingResult.avg < 10 ? "#00e676" : pingResult.avg < 50 ? "#ffb300" : "#ff3d3d" },
                    { l: "Min", v: `${pingResult.min} ms`, c: "#00d4ff" },
                    { l: "Max", v: `${pingResult.max} ms`, c: pingResult.max > 100 ? "#ff3d3d" : "#ffb300" },
                    { l: "P95", v: `${pingResult.p95} ms`, c: pingResult.p95 > 50 ? "#ff3d3d" : "#00e676" },
                  ].map(({ l, v, c }) => (
                    <Box key={l} sx={{ textAlign: "center" }}>
                      <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.65rem", color: "#7d8590", mb: 0.3 }}>{l}</Typography>
                      <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.9rem", color: c, fontWeight: 700 }}>{v}</Typography>
                    </Box>
                  ))}
                </Box>
                {pingResult.avg > 30 && (
                  <Box sx={{ mt: 1, px: 1.5, py: 0.8, bgcolor: "#ffb30010", border: "1px solid #ffb30030", borderLeft: "3px solid #ffb300" }}>
                    <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.72rem", color: "#ffb300cc" }}>
                      ⚠ High latency detected. Consider using Ethernet instead of WiFi for better performance.
                    </Typography>
                  </Box>
                )}
              </>
            ) : (
              <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.78rem", color: "#ff3d3d" }}>
                ✗ Ping failed: {pingResult.error}
              </Typography>
            )}
          </Box>
        )}
      </SectionPanel>

      {/* ═══ PIPELINE BENCHMARK ═══ */}
      <SectionPanel title="Pipeline Benchmark">
        <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.75rem", color: "#7d8590", mb: 2, lineHeight: 1.7 }}>
          Tests the full detection pipeline: RTSP decode → GPU transfer → color convert → resize → YOLO inference.
          Identifies the bottleneck and suggests optimisations.
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 2 }}>
          <TextField label="RTSP URL" placeholder="rtsp://admin:pass@192.168.1.100:554/cam/realmonitor?channel=1&subtype=0"
            value={benchRtsp} onChange={(e) => setBenchRtsp(e.target.value)} size="small" fullWidth
            sx={{ "& .MuiInputBase-root": { fontFamily: '"IBM Plex Mono"', fontSize: "0.78rem", bgcolor: "#0d1117", color: "#e6edf3" },
              "& .MuiInputLabel-root": { fontFamily: '"IBM Plex Mono"', fontSize: "0.75rem", color: "#7d8590" },
              "& .MuiOutlinedInput-notchedOutline": { borderColor: "#1c2333" } }} />
          <TextField label="Model Path (optional — skip for decode-only test)"
            placeholder="C:\...\best.engine"
            value={benchModel} onChange={(e) => setBenchModel(e.target.value)} size="small" fullWidth
            sx={{ "& .MuiInputBase-root": { fontFamily: '"IBM Plex Mono"', fontSize: "0.78rem", bgcolor: "#0d1117", color: "#e6edf3" },
              "& .MuiInputLabel-root": { fontFamily: '"IBM Plex Mono"', fontSize: "0.75rem", color: "#7d8590" },
              "& .MuiOutlinedInput-notchedOutline": { borderColor: "#1c2333" } }} />
        </Box>
        <Box sx={{ display: "flex", gap: 1.5, mb: 2 }}>
          {!benchStatus.running ? (
            <Button onClick={handleStartBench} disabled={!benchRtsp.trim()} variant="contained" size="small"
              sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.75rem", bgcolor: "#00d4ff20", color: "#00d4ff",
                border: "1px solid #00d4ff40", "&:hover": { bgcolor: "#00d4ff30" }, textTransform: "none" }}>
              ▶ Run Benchmark
            </Button>
          ) : (
            <Button onClick={handleStopBench} variant="contained" size="small"
              sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.75rem", bgcolor: "#ff3d3d20", color: "#ff3d3d",
                border: "1px solid #ff3d3d40", "&:hover": { bgcolor: "#ff3d3d30" }, textTransform: "none" }}>
              ■ Stop
            </Button>
          )}
        </Box>

        {/* Progress */}
        {benchStatus.running && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
              <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.72rem", color: "#00d4ff" }}>{benchStatus.stage}</Typography>
              <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.72rem", color: "#7d8590" }}>{benchStatus.progress}%</Typography>
            </Box>
            <LinearProgress variant="determinate" value={benchStatus.progress}
              sx={{ height: 6, borderRadius: 1, bgcolor: "#1c2333", "& .MuiLinearProgress-bar": { bgcolor: "#00d4ff" } }} />
          </Box>
        )}

        {benchStatus.error && (
          <Box sx={{ px: 2, py: 1, mb: 2, bgcolor: "#ff3d3d0d", border: "1px solid #ff3d3d30", borderLeft: "3px solid #ff3d3d" }}>
            <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.75rem", color: "#ff3d3dcc" }}>Error: {benchStatus.error}</Typography>
          </Box>
        )}

        {/* ── Results ── */}
        {r && !benchStatus.running && (
          <Box>
            {/* Summary cards */}
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1.5, mb: 2 }}>
              <Box sx={{ px: 2, py: 1.2, bgcolor: "#0d1117", border: "1px solid #1c2333", borderTop: "2px solid #00d4ff" }}>
                <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.62rem", color: "#7d8590", mb: 0.3 }}>Decoder</Typography>
                <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.85rem", color: "#00d4ff", fontWeight: 700 }}>{r.decoder}</Typography>
              </Box>
              <Box sx={{ px: 2, py: 1.2, bgcolor: "#0d1117", border: "1px solid #1c2333", borderTop: "2px solid #00e676" }}>
                <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.62rem", color: "#7d8590", mb: 0.3 }}>Connect Time</Typography>
                <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.85rem", color: "#00e676", fontWeight: 700 }}>{r.connect_ms} ms</Typography>
              </Box>
              {r.inference_fps && (
                <Box sx={{ px: 2, py: 1.2, bgcolor: "#0d1117", border: "1px solid #1c2333", borderTop: "2px solid #ffb300" }}>
                  <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.62rem", color: "#7d8590", mb: 0.3 }}>Inference FPS</Typography>
                  <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.85rem", color: "#ffb300", fontWeight: 700 }}>{r.inference_fps}</Typography>
                </Box>
              )}
            </Box>

            {/* Pipeline breakdown bars */}
            <Box sx={{ p: 2, bgcolor: "#0d1117", border: "1px solid #1c2333", borderRadius: 1, mb: 2 }}>
              <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.68rem", color: "#7d8590", letterSpacing: "0.12em", textTransform: "uppercase", mb: 1.5 }}>
                Pipeline Breakdown (avg ms)
              </Typography>
              {(() => {
                const maxMs = Math.max(r.decode?.avg||0, r.download?.avg||0, r.convert?.avg||0, r.resize?.avg||0, r.inference?.avg||0, 1);
                return (
                  <>
                    <MetricBar label="GPU Decode (NVDEC)" ms={r.decode?.avg || 0} maxMs={maxMs} />
                    <MetricBar label="GPU → CPU Download" ms={r.download?.avg || 0} maxMs={maxMs} />
                    <MetricBar label="BGRA → BGR Convert" ms={r.convert?.avg || 0} maxMs={maxMs} />
                    <MetricBar label="Resize → 640×640" ms={r.resize?.avg || 0} maxMs={maxMs} />
                    {r.inference && <MetricBar label="YOLO TensorRT Inference" ms={r.inference.avg} maxMs={maxMs} />}
                  </>
                );
              })()}
            </Box>

            {/* Bottleneck callout */}
            <Box sx={{ px: 2, py: 1.2, bgcolor: "#ffb3000d", border: "1px solid #ffb30030", borderLeft: "3px solid #ffb300", mb: 1 }}>
              <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.78rem", color: "#ffb300", fontWeight: 600, mb: 0.3 }}>
                Bottleneck: {r.bottleneck} ({r.bottleneck_ms} ms)
              </Typography>
              <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.72rem", color: "#ffb300cc" }}>
                {r.tip}
              </Typography>
            </Box>
          </Box>
        )}
      </SectionPanel>
    </Box>
  );
}
