import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Box, Grid, TextField, Button, Select, MenuItem,
  InputLabel, FormControl, Typography, Tooltip, IconButton, Switch
} from "@mui/material";
import { startTraining, stopTraining, getTrainingStatus, getTrainingMetrics,
         startEvaluate, stopEvaluate, getEvaluateStatus, loadTrainingConfig } from "../api";
import { PageHeader, LogPanel, SectionPanel } from "../components";

const mono = { fontFamily: '"IBM Plex Mono",monospace' };

const Field = React.memo(({ label, value, onChange, type, tooltip }) => (
  <Tooltip title={tooltip || ""} placement="top" arrow>
    <TextField label={label} size="small" fullWidth sx={{ mb: 0 }}
      type={type || "text"} value={value ?? ""}
      onChange={onChange} InputLabelProps={{ shrink: true }}
      inputProps={{ autoComplete: "off" }} />
  </Tooltip>
));

const ToggledField = React.memo(({ label, value, onChange, enabled, onToggle, type, tooltip }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
    <Tooltip title={enabled ? "Remove from command" : "Add to command"} placement="left">
      <Switch size="small" checked={enabled} onChange={onToggle}
        sx={{ "& .MuiSwitch-switchBase.Mui-checked": { color: "#00d4ff" },
              "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: "#00d4ff40" },
              flexShrink: 0 }} />
    </Tooltip>
    <Box sx={{ flex: 1, opacity: enabled ? 1 : 0.35, transition: "opacity 0.2s" }}>
      <Field label={label} value={value} onChange={onChange} type={type} tooltip={tooltip} />
    </Box>
  </Box>
));

const MODELS = [
  { value: "yolo26n.pt", label: "yolo26n  ·  Nano  —  fastest" },
  { value: "yolo26s.pt", label: "yolo26s  ·  Small  —  balanced" },
  { value: "yolo26m.pt", label: "yolo26m  ·  Medium  —  accurate" },
  { value: "yolo26l.pt", label: "yolo26l  ·  Large  —  best accuracy" },
  { value: "__custom__", label: "Custom / trained model path…" },
];

// ── Core defaults ──────────────────────────────────────────────────────────
const DEFAULT = {
  data_yaml: "", model: "yolo26s.pt", epochs: 60, imgsz: 640,
  batch: 12, name: "dronesentinel_train", project: "runs/train",
  // optional — toggled
  patience: 15, workers: 4, lr0: 0.01, mosaic: 1.0, device: "0",
  // advanced optional
  lrf: 0.01, weight_decay: 0.0005, dropout: 0.0,
  optimizer: "auto", iou: 0.7, close_mosaic: 10, seed: 0,
  deterministic: "False", amp: "True", exist_ok: "False",
};

// Keys that have a toggle switch (can be excluded from command)
const OPTIONAL_KEYS = [
  "patience","workers","lr0","mosaic","device",
  "lrf","weight_decay","dropout","optimizer","iou","close_mosaic","seed",
  "deterministic","amp","exist_ok",
];

const DEFAULT_ENABLED = {
  patience: true, workers: true, lr0: true, mosaic: true, device: true,
  lrf: false, weight_decay: false, dropout: false, optimizer: false,
  iou: false, close_mosaic: false, seed: false,
  deterministic: true, amp: false, exist_ok: false,
};

const DEFAULT_LAST_PT =
  "D:\\Tech\\Programming\\Uni\\Cybersecurity Major\\Graduation Project\\Project\\dronesentinel\\runs\\train\\dronesentinel_train3\\weights\\last.pt";

// ── Build command from fields ──────────────────────────────────────────────
function buildTrainCmd(c, en) {
  // core always-included params
  let cmd = `yolo train data="${c.data_yaml || "<data.yaml>"}" model=${c.model}` +
    ` epochs=${c.epochs} imgsz=${c.imgsz} batch=${c.batch}`;
  // optional toggled params
  const optMap = {
    patience: c.patience, workers: c.workers, lr0: c.lr0,
    mosaic: c.mosaic, device: c.device, lrf: c.lrf,
    weight_decay: c.weight_decay, dropout: c.dropout, optimizer: c.optimizer,
    iou: c.iou, close_mosaic: c.close_mosaic, seed: c.seed,
    deterministic: c.deterministic, amp: c.amp, exist_ok: c.exist_ok,
  };
  Object.entries(optMap).forEach(([k, v]) => {
    if (en[k]) cmd += ` ${k}=${v}`;
  });
  cmd += ` name=${c.name} project="${c.project}"`;
  return cmd;
}

// ── Parse command back into fields ────────────────────────────────────────
function parseTrainCmd(cmd) {
  const get = (key) => {
    const m = cmd.match(new RegExp(`(?:^|\\s)${key}=("([^"]+)"|([^\\s]+))`));
    return m ? (m[2] ?? m[3]) : null;
  };
  const parsed = {};
  const newEnabled = {};
  if (get("data"))    parsed.data_yaml = get("data");
  if (get("model"))   parsed.model = get("model");
  if (get("epochs"))  parsed.epochs = get("epochs");
  if (get("imgsz"))   parsed.imgsz = get("imgsz");
  if (get("batch"))   parsed.batch = get("batch");
  if (get("name"))    parsed.name = get("name");
  if (get("project")) parsed.project = get("project");
  OPTIONAL_KEYS.forEach(k => {
    const v = get(k);
    if (v !== null) { parsed[k] = v; newEnabled[k] = true; }
    else            { newEnabled[k] = false; }
  });
  return { parsed, newEnabled };
}

function buildEvalCmd(e) {
  let cmd = `yolo val data="${e.data_yaml || "<data.yaml>"}" model="${e.model_pt || "<best.pt>"}"`;
  cmd += ` split=${e.split} imgsz=${e.imgsz} device=${e.device}`;
  if (e.save_json) cmd += ` save_json=True`;
  if (e.save_txt)  cmd += ` save_txt=True`;
  return cmd;
}

function parseEvalCmd(cmd) {
  const get = (key) => {
    const m = cmd.match(new RegExp(`(?:^|\\s)${key}=("([^"]+)"|([^\\s]+))`));
    return m ? (m[2] ?? m[3]) : null;
  };
  const parsed = {};
  if (get("data"))  parsed.data_yaml = get("data");
  if (get("model")) parsed.model_pt  = get("model");
  if (get("split")) parsed.split     = get("split");
  if (get("imgsz")) parsed.imgsz     = get("imgsz");
  if (get("device"))parsed.device    = get("device");
  parsed.save_json = /save_json=True/i.test(cmd);
  parsed.save_txt  = /save_txt=True/i.test(cmd);
  return parsed;
}

// ── Metric helpers ─────────────────────────────────────────────────────────
function MetricRow({ label, value, highlight }) {
  const display = value == null ? "—" : typeof value === "number" ? value.toFixed(4) : value;
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
      <Typography sx={{ ...mono, fontSize: "0.68rem", color: "#7d8590" }}>{label}</Typography>
      <Typography sx={{ ...mono, fontSize: "0.68rem", color: highlight || "#e6edf3", fontWeight: highlight ? 700 : 400 }}>
        {display}
      </Typography>
    </Box>
  );
}

function MetricCard({ title, data, color }) {
  return (
    <Box sx={{ bgcolor: "#0d1117", border: `1px solid ${color}30`, borderLeft: `3px solid ${color}`,
      borderRadius: 1, p: 1.5, height: "100%" }}>
      <Typography sx={{ ...mono, fontSize: "0.65rem", color, letterSpacing: "0.08em",
        textTransform: "uppercase", mb: 1 }}>{title}</Typography>
      {!data ? (
        <Typography sx={{ ...mono, fontSize: "0.68rem", color: "#7d8590" }}>Waiting for epoch…</Typography>
      ) : (
        <>
          <MetricRow label="Epoch"        value={data.epoch} />
          <MetricRow label="mAP50"        value={data.mAP50}    highlight={color} />
          <MetricRow label="mAP50-95"     value={data.mAP50_95} />
          <MetricRow label="Precision"    value={data.precision} />
          <MetricRow label="Recall"       value={data.recall} />
          <Box sx={{ my: 0.5, borderTop: "1px solid #1c2333" }} />
          <MetricRow label="Box Loss"     value={data.box_loss} />
          <MetricRow label="Cls Loss"     value={data.cls_loss} />
          <MetricRow label="DFL Loss"     value={data.dfl_loss} />
          <MetricRow label="Val Box Loss" value={data.val_box_loss} />
        </>
      )}
    </Box>
  );
}

function GaugeBar({ value, max, color, label, unit = "%" }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : value;
  return (
    <Box sx={{ mb: 1 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.3 }}>
        <Typography sx={{ ...mono, fontSize: "0.65rem", color: "#7d8590" }}>{label}</Typography>
        <Typography sx={{ ...mono, fontSize: "0.65rem", color }}>
          {value == null ? "—" : max ? `${value} / ${max} MB` : `${value}${unit}`}
        </Typography>
      </Box>
      <Box sx={{ height: 4, bgcolor: "#1c2333", borderRadius: 1 }}>
        <Box sx={{ height: "100%", width: `${pct ?? 0}%`, bgcolor: color, borderRadius: 1,
          transition: "width 1s ease",
          boxShadow: value > (max ? max * 0.85 : 85) ? `0 0 6px ${color}` : "none" }} />
      </Box>
    </Box>
  );
}

function HWCard({ hw }) {
  const gpuColor = hw?.gpu_temp > 80 ? "#ff3d3d" : hw?.gpu_temp > 65 ? "#ffb300" : "#00d4ff";
  const cpuColor = hw?.cpu_pct  > 90 ? "#ff3d3d" : "#a5d6ff";
  return (
    <Box sx={{ bgcolor: "#0d1117", border: "1px solid #00d4ff30", borderLeft: "3px solid #00d4ff",
      borderRadius: 1, p: 1.5, height: "100%" }}>
      <Typography sx={{ ...mono, fontSize: "0.65rem", color: "#00d4ff", letterSpacing: "0.08em",
        textTransform: "uppercase", mb: 1.2 }}>Hardware</Typography>
      {!hw ? (
        <Typography sx={{ ...mono, fontSize: "0.68rem", color: "#7d8590" }}>Loading…</Typography>
      ) : (
        <>
          <Typography sx={{ ...mono, fontSize: "0.62rem", color: "#7d8590", mb: 0.5 }}>GPU</Typography>
          <GaugeBar label="Utilization" value={hw.gpu_util}     max={null}            color={gpuColor} />
          <GaugeBar label="VRAM"        value={hw.gpu_mem_used} max={hw.gpu_mem_total} color="#00d4ff" unit="%" />
          <MetricRow label="Temperature" value={hw.gpu_temp != null ? `${hw.gpu_temp} °C` : null} highlight={gpuColor} />
          <Box sx={{ my: 0.8, borderTop: "1px solid #1c2333" }} />
          <Typography sx={{ ...mono, fontSize: "0.62rem", color: "#7d8590", mb: 0.5 }}>CPU</Typography>
          <GaugeBar label="Usage"       value={hw.cpu_pct} max={null} color={cpuColor} />
          <MetricRow label="Temperature" value={hw.cpu_temp != null ? `${hw.cpu_temp} °C` : null} />
        </>
      )}
    </Box>
  );
}

function EditableCmd({ value, onChange, color = "#00e676", label = "Command" }) {
  return (
    <TextField label={label} multiline minRows={2} fullWidth size="small"
      value={value} onChange={(e) => onChange(e.target.value)}
      InputLabelProps={{ shrink: true }} inputProps={{ spellCheck: false }}
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

function CopyBtn({ text, copied, onCopy }) {
  return (
    <Tooltip title={copied ? "Copied!" : "Copy"} placement="top">
      <IconButton size="small" onClick={onCopy}
        sx={{ color: copied ? "#00e676" : "#7d8590", "&:hover": { color: "#e6edf3" }, flexShrink: 0 }}>
        {copied ? "✓" : "⧉"}
      </IconButton>
    </Tooltip>
  );
}

// ── Module-level cache — survives React unmount/remount on tab navigation ──
const _tEvalCfgDefault = { data_yaml: "", model_pt: "", split: "test", imgsz: 640, device: "0", save_json: false, save_txt: false };
let _tCfg = DEFAULT;
let _tEnabled = DEFAULT_ENABLED;
let _tResumePath = DEFAULT_LAST_PT;
let _tEvalCfg = { ..._tEvalCfgDefault };
let _tRunDir = "";
let _tRunning = false;
let _tLog = [];
let _tProgress = 0;
let _tEpochInfo = { current: 0, total: 0 };
let _tLiveMetrics = null;
let _tStartDisplay = "";
let _tEndDisplay = "";
let _tBatchInfo = null;
let _tEpochLog = [];
let _tEvalRunning = false;
let _tEvalLog = [];
let _tStartTimeMs = null;
let _tEpochLogData = [];
let _tCurrentEpochData = null;

// ── Main component ─────────────────────────────────────────────────────────
export default function Training() {
  // Initialize from module-level cache so values survive tab navigation
  const [cfg, setCfg]              = useState(_tCfg);
  const [enabled, setEnabled]      = useState(_tEnabled);
  const [trainCmd, setTrainCmdRaw] = useState(() => buildTrainCmd(_tCfg, _tEnabled));
  const [resumePath, setResumePath]= useState(_tResumePath);
  const [running, setRunning]      = useState(_tRunning);
  const [log, setLog]              = useState(_tLog);
  const [progress, setProgress]    = useState(_tProgress);
  const [epochInfo, setEpochInfo]  = useState(_tEpochInfo);
  const [copied, setCopied]        = useState(false);
  const [liveMetrics, setLiveMetrics] = useState(_tLiveMetrics);
  const [runDir, setRunDir]        = useState(_tRunDir);
  const [elapsed, setElapsed]        = useState("");
  const [batchInfo, setBatchInfo]    = useState(_tBatchInfo);
  const startTimeRef   = useRef(_tStartTimeMs);
  const [startDisplay, setStartDisplay] = useState(_tStartDisplay);
  const [endDisplay,   setEndDisplay]   = useState(_tEndDisplay);
  const [epochLog, setEpochLog]      = useState(_tEpochLog);
  const epochLogRef    = useRef(_tEpochLogData);
  const currentEpochRef = useRef(_tCurrentEpochData);
  const [evalCfg, setEvalCfg]      = useState(_tEvalCfg);
  const [evalCmd, setEvalCmdRaw]   = useState(() => buildEvalCmd(_tEvalCfg));
  const [evalRunning, setEvalRunning] = useState(_tEvalRunning);
  const [evalLog, setEvalLog]       = useState(_tEvalLog);
  const [evalCopied, setEvalCopied] = useState(false);
  const evalLogRef    = useRef(null);
  const allEvalLogRef = useRef([]);
  const logRef        = useRef(null);
  const allLogRef     = useRef([]);
  const cmdEditRef    = useRef(false);

  const syncCmdFromFields = useCallback((c, en) => {
    if (!cmdEditRef.current) setTrainCmdRaw(buildTrainCmd(c, en));
  }, []);

  // Stable field handlers
  const handlers = useRef({});
  Object.keys(DEFAULT).forEach((key) => {
    if (!handlers.current[key])
      handlers.current[key] = (e) => setCfg((p) => {
        const next = { ...p, [key]: e.target.value };
        syncCmdFromFields(next, enabled);
        return next;
      });
  });
  const h = handlers.current;

  // Stable toggle handlers
  const toggleHandlers = useRef({});
  OPTIONAL_KEYS.forEach((key) => {
    if (!toggleHandlers.current[key])
      toggleHandlers.current[key] = () => setEnabled((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        setTrainCmdRaw(buildTrainCmd(cfg, next));
        return next;
      });
  });
  const th = toggleHandlers.current;

  useEffect(() => {
    if (!cmdEditRef.current) setTrainCmdRaw(buildTrainCmd(cfg, enabled));
  }, [cfg, enabled]); // eslint-disable-line

  useEffect(() => { setEvalCmdRaw(buildEvalCmd(evalCfg)); }, [evalCfg]);

  // Sync state → module-level cache on every change
  useEffect(() => { _tCfg = cfg; }, [cfg]);
  useEffect(() => { _tEnabled = enabled; }, [enabled]);
  useEffect(() => { _tResumePath = resumePath; }, [resumePath]);
  useEffect(() => { _tEvalCfg = evalCfg; }, [evalCfg]);
  useEffect(() => { _tRunDir = runDir; }, [runDir]);
  useEffect(() => { _tRunning = running; }, [running]);
  useEffect(() => { _tLog = log; }, [log]);
  useEffect(() => { _tProgress = progress; }, [progress]);
  useEffect(() => { _tEpochInfo = epochInfo; }, [epochInfo]);
  useEffect(() => { _tLiveMetrics = liveMetrics; }, [liveMetrics]);
  useEffect(() => { _tStartDisplay = startDisplay; }, [startDisplay]);
  useEffect(() => { _tEndDisplay = endDisplay; }, [endDisplay]);
  useEffect(() => { _tBatchInfo = batchInfo; }, [batchInfo]);
  useEffect(() => { _tEpochLog = epochLog; }, [epochLog]);
  useEffect(() => { _tEvalRunning = evalRunning; }, [evalRunning]);
  useEffect(() => { _tEvalLog = evalLog; }, [evalLog]);
  // Capture ref values on unmount so elapsed timer + epoch log survive navigation
  useEffect(() => () => {
    _tStartTimeMs = startTimeRef.current;
    _tEpochLogData = epochLogRef.current;
    _tCurrentEpochData = currentEpochRef.current;
  }, []);

  const handleTrainCmdChange = (val) => {
    cmdEditRef.current = true;
    setTrainCmdRaw(val);
    try {
      const { parsed, newEnabled } = parseTrainCmd(val);
      setCfg(p => ({ ...p, ...parsed }));
      setEnabled(p => ({ ...p, ...newEnabled }));
    } catch (_) {}
    cmdEditRef.current = false;
  };

  const handleEvalCmdChange = (val) => {
    setEvalCmdRaw(val);
    try { setEvalCfg(p => ({ ...p, ...parseEvalCmd(val) })); } catch (_) {}
  };

  // Elapsed timer — interval depends ONLY on `running`.
  // startTimeRef is a ref so reading it never triggers this effect to re-run.
  useEffect(() => {
    if (!running) { setElapsed(""); return; }
    const tick = () => {
      if (!startTimeRef.current) return;
      const s = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
      setElapsed(`${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}:${String(ss).padStart(2,"0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [running]); // ← only running — interval is created once and never reset mid-run

  // Polling: training
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const { data } = await getTrainingStatus();
        setRunning(data.running);
        // Set start time once when training first detected running (ref = no re-render)
        if (data.running && !startTimeRef.current) {
          startTimeRef.current = Date.now();
          setStartDisplay(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        }
        if (!data.running) {
          startTimeRef.current = null; setBatchInfo(null); setStartDisplay("");
          // record training end time
          setEndDisplay(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
          // close any open epoch entry
          if (currentEpochRef.current) {
            const { epoch, startMs } = currentEpochRef.current;
            const elapsedSec = Math.round((Date.now() - startMs) / 1000);
            const entry = { epoch, start: new Date(startMs).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"}), end: new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"}), elapsedSec };
            epochLogRef.current = [...epochLogRef.current.filter(e => e.epoch !== epoch), entry];
            setEpochLog([...epochLogRef.current]);
            currentEpochRef.current = null;
          }
        }
        const incoming = data.log || [];
        if (incoming.length > allLogRef.current.length) {
          allLogRef.current = incoming; setLog([...incoming]);
        }
        // Parse epoch progress from lines like "1/50   5.96G   1.973   3.38  1.909  25  640:"
        const epochLine = [...incoming].reverse().find((l) => /^\s*\d+\/\d+\s/.test(l));
        if (epochLine) {
          const m = epochLine.match(/^\s*(\d+)\/(\d+)/);
          if (m) {
            const cur = parseInt(m[1]), tot = parseInt(m[2]);
            setEpochInfo({ current: cur, total: tot });
            setProgress(Math.round((cur / tot) * 100));

            // ── Epoch timing tracking ──────────────────────────────────────
            // New epoch started: open a new entry
            if (!currentEpochRef.current || currentEpochRef.current.epoch !== cur) {
              // Close previous epoch if any
              if (currentEpochRef.current) {
                const { epoch: prevEpoch, startMs: prevStartMs } = currentEpochRef.current;
                const elapsedSec = Math.round((Date.now() - prevStartMs) / 1000);
                const endTs = new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"});
                const startTs = new Date(prevStartMs).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"});
                const closed = { epoch: prevEpoch, start: startTs, end: endTs, elapsedSec };
                epochLogRef.current = [...epochLogRef.current.filter(e => e.epoch !== prevEpoch), closed];
              }
              // Open new epoch — only if not already tracked as complete
              if (!epochLogRef.current.find(e => e.epoch === cur && e.end)) {
                currentEpochRef.current = { epoch: cur, startMs: Date.now() };
                const startTs = new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"});
                const inProgress = { epoch: cur, start: startTs, end: null, elapsedSec: null };
                epochLogRef.current = [...epochLogRef.current.filter(e => e.epoch !== cur), inProgress];
              }
              setEpochLog([...epochLogRef.current]);
            }
          }
        }
        // Parse batch progress from lines like "1/50  5.96G  1.973  …  640:  2%  ──  47/3080"
        const batchLine = [...incoming].reverse().find((l) =>
          /\d+\/\d+\s+\d+/.test(l) && /\d+%/.test(l) && /\d+\/\d+\s*$/.test(l.replace(/[^\S\n]+/g," ").trim())
        );
        if (batchLine) {
          const bm = batchLine.match(/(\d+)%.*?(\d+)\/(\d+)\s*$/);
          if (bm) {
            const pct = parseInt(bm[1]), bCur = parseInt(bm[2]), bTot = parseInt(bm[3]);
            // extract losses: box cls dfl
            const nums = batchLine.match(/[\d.]+/g) || [];
            setBatchInfo({ pct, cur: bCur, total: bTot,
              box: nums[3] ?? null, cls: nums[4] ?? null, dfl: nums[5] ?? null });
          }
        }
        if (data.running && runDir) {
          try { const { data: mx } = await getTrainingMetrics(runDir); setLiveMetrics(mx); } catch (_) {}
        } else if (data.running) {
          try { const { data: mx } = await getTrainingMetrics(""); setLiveMetrics(p => ({ ...p, hw: mx.hw })); } catch (_) {}
        }
      } catch (_) {}
    }, 1500);
    return () => clearInterval(id);
  }, []);

  // Polling: eval
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const { data } = await getEvaluateStatus();
        setEvalRunning(data.running);
        const incoming = data.log || [];
        if (incoming.length > allEvalLogRef.current.length) {
          allEvalLogRef.current = incoming; setEvalLog([...incoming]);
        }
      } catch (_) {}
    }, 1500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { if (logRef.current)     logRef.current.scrollTop     = logRef.current.scrollHeight; }, [log]);
  useEffect(() => { if (evalLogRef.current) evalLogRef.current.scrollTop = evalLogRef.current.scrollHeight; }, [evalLog]);

  const handleStart = async () => {
    if (!cfg.data_yaml) { alert("Please enter Data YAML path"); return; }
    const payload = {
      ...cfg,
      epochs: parseInt(cfg.epochs), imgsz: parseInt(cfg.imgsz), batch: parseInt(cfg.batch),
      ...(enabled.patience     ? { patience:     parseInt(cfg.patience)      } : { patience: null }),
      ...(enabled.workers      ? { workers:      parseInt(cfg.workers)       } : { workers:  null }),
      ...(enabled.lr0          ? { lr0:          parseFloat(cfg.lr0)         } : { lr0:      null }),
      ...(enabled.mosaic       ? { mosaic:        parseFloat(cfg.mosaic)     } : { mosaic:   null }),
      ...(enabled.device       ? { device:        cfg.device                 } : { device:   null }),
      ...(enabled.lrf          ? { lrf:           parseFloat(cfg.lrf)        } : { lrf:      null }),
      ...(enabled.weight_decay ? { weight_decay:  parseFloat(cfg.weight_decay)} : { weight_decay: null }),
      ...(enabled.dropout      ? { dropout:       parseFloat(cfg.dropout)    } : { dropout:  null }),
      ...(enabled.optimizer    ? { optimizer:      cfg.optimizer              } : { optimizer: null }),
      ...(enabled.iou          ? { iou:           parseFloat(cfg.iou)        } : { iou:      null }),
      ...(enabled.close_mosaic ? { close_mosaic:   parseInt(cfg.close_mosaic)} : { close_mosaic: null }),
      ...(enabled.seed         ? { seed:           parseInt(cfg.seed)        } : { seed:     null }),
      ...(enabled.deterministic? { deterministic:  cfg.deterministic         } : { deterministic: null }),
      ...(enabled.amp          ? { amp:            cfg.amp                   } : { amp:      null }),
      ...(enabled.exist_ok     ? { exist_ok:        cfg.exist_ok             } : { exist_ok: null }),
    };
    try {
      await startTraining(payload);
      startTimeRef.current = Date.now();
      setStartDisplay(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setEndDisplay("");
      epochLogRef.current = []; setEpochLog([]); currentEpochRef.current = null;
      setRunning(true); setProgress(0); setBatchInfo(null);
      setEpochInfo({ current: 0, total: parseInt(cfg.epochs) });
      allLogRef.current = []; setLog([]);
    } catch (e) { alert(e.response?.data?.detail || "Failed to start"); }
  };

  const handleStop = async () => { await stopTraining(); setRunning(false); };
  const handleResume = async () => {
    try {
      const res = await fetch("/training/resume", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ last_pt: resumePath }),
      });
      if (!res.ok) { const err = await res.json(); alert("Failed: " + (err.detail || res.statusText)); return; }
      setRunning(true); allLogRef.current = []; setLog([]);
      startTimeRef.current = Date.now();
      setStartDisplay(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setEndDisplay("");
      epochLogRef.current = []; setEpochLog([]); currentEpochRef.current = null;
      setBatchInfo(null);
    } catch (e) { alert("Failed to resume: " + e.message); }
  };

  const handleCopy = () => { navigator.clipboard.writeText(trainCmd); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  const handleEvalStart = async () => {
    if (!evalCfg.data_yaml) { alert("Please enter Data YAML path"); return; }
    if (!evalCfg.model_pt)  { alert("Please enter model path (best.pt)"); return; }
    try {
      await startEvaluate({ ...evalCfg, imgsz: parseInt(evalCfg.imgsz) });
      allEvalLogRef.current = []; setEvalLog([]);
    } catch (e) { alert(e.response?.data?.detail || "Failed to start evaluation"); }
  };
  const handleEvalStop = async () => { await stopEvaluate(); };
  const handleEvalCopy = () => { navigator.clipboard.writeText(evalCmd); setEvalCopied(true); setTimeout(() => setEvalCopied(false), 1800); };
  const eh = (key) => (e) => setEvalCfg(p => ({ ...p, [key]: e.target.value }));

  // #8 — Load config from previous run
  const [loadRunDir, setLoadRunDir]     = useState("");
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [loadMsg, setLoadMsg]           = useState("");
  const handleLoadConfig = async () => {
    if (!loadRunDir.trim()) return;
    setLoadingConfig(true); setLoadMsg("");
    try {
      const { data } = await loadTrainingConfig(loadRunDir.trim());
      const c = data.config || {};
      setCfg(prev => ({
        ...prev,
        ...(c.data    ? { data_yaml: c.data }                : {}),
        ...(c.model   ? { model: c.model }                   : {}),
        ...(c.epochs  != null ? { epochs: c.epochs }         : {}),
        ...(c.imgsz   != null ? { imgsz: c.imgsz }           : {}),
        ...(c.batch   != null ? { batch: c.batch }           : {}),
        ...(c.name    ? { name: c.name }                     : {}),
        ...(c.project ? { project: c.project }               : {}),
        ...(c.patience != null ? { patience: c.patience }    : {}),
        ...(c.workers  != null ? { workers: c.workers }      : {}),
        ...(c.lr0      != null ? { lr0: c.lr0 }              : {}),
        ...(c.mosaic   != null ? { mosaic: c.mosaic }        : {}),
        ...(c.device   != null ? { device: String(c.device) }: {}),
      }));
      setLoadMsg("✓ Config loaded from args.yaml");
    } catch (e) {
      setLoadMsg("⚠ " + (e.response?.data?.detail || "Failed to load config"));
    } finally {
      setLoadingConfig(false);
      setTimeout(() => setLoadMsg(""), 6000);
    }
  };

  // True when cfg.model is not one of the predefined MODELS values
  const isCustomModel = !MODELS.slice(0, -1).some(m => m.value === cfg.model);

  return (
    <Box sx={{ p: 3, maxWidth: 960 }}>
      <PageHeader icon="◎" title="Train Custom Model" subtitle="YOLOv26 fine-tuning on custom drone dataset" />

      {/* Status bar */}
      <Box sx={{ mb: 1, px: 2, py: 1.5, bgcolor: "#0d1117", border: "1px solid #1c2333",
        borderLeft: `3px solid ${running ? "#ffb300" : "#1c2333"}`, display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: running ? "#ffb300" : "#7d8590",
          boxShadow: running ? "0 0 8px #ffb300" : "none", flexShrink: 0,
          animation: running ? "pulse 1.5s infinite" : "none",
          "@keyframes pulse": { "0%,100%": { opacity: 1 }, "50%": { opacity: 0.3 } } }} />
        <Typography sx={{ ...mono, fontSize: "0.75rem", color: running ? "#ffb300" : "#7d8590",
          letterSpacing: "0.1em", textTransform: "uppercase" }}>
          {running ? "Training in Progress" : "Idle"}
        </Typography>
        {running && startDisplay && (
          <Box sx={{ ml: "auto", display: "flex", gap: 2.5, alignItems: "center", flexWrap: "wrap" }}>
            <Typography sx={{ ...mono, fontSize: "0.72rem", color: "#7d8590" }}>
              epoch <span style={{color:"#e6edf3"}}>{epochInfo.current}</span>/{epochInfo.total}
              &nbsp;&nbsp;{progress}%
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <Typography sx={{ ...mono, fontSize: "0.68rem", color: "#ffb300", letterSpacing: "0.05em" }}>
                ⏱ {elapsed}
              </Typography>
              <Typography sx={{ ...mono, fontSize: "0.62rem", color: "#7d8590" }}>
                started {startDisplay}
              </Typography>
            </Box>
          </Box>
        )}
        {!running && endDisplay && (
          <Box sx={{ ml: "auto", display: "flex", gap: 3, alignItems: "center" }}>
            <Typography sx={{ ...mono, fontSize: "0.68rem", color: "#7d8590" }}>
              started <span style={{color:"#e6edf3"}}>{startDisplay || "—"}</span>
            </Typography>
            <Typography sx={{ ...mono, fontSize: "0.68rem", color: "#00e676" }}>
              ✓ ended {endDisplay}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Epoch progress bar */}
      <Box sx={{ height: 4, bgcolor: "#1c2333", position: "relative" }}>
        <Box sx={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${progress}%`,
          bgcolor: "#ffb300", boxShadow: running ? "0 0 8px #ffb30060" : "none", transition: "width 0.5s ease" }} />
      </Box>

      {/* Batch progress bar — shows within-epoch progress */}
      {running && batchInfo && (
        <Box sx={{ mb: 0, bgcolor: "#020408", border: "1px solid #1c2333",
          borderTop: "none", px: 2, py: 1, display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <Typography sx={{ ...mono, fontSize: "0.68rem", color: "#7d8590", flexShrink: 0 }}>
            batch <span style={{color:"#e6edf3"}}>{batchInfo.cur}</span>/{batchInfo.total}
          </Typography>
          <Box sx={{ flex: 1, minWidth: 80, height: 4, bgcolor: "#1c2333", borderRadius: 1 }}>
            <Box sx={{ height: "100%", width: `${batchInfo.pct}%`, bgcolor: "#00d4ff",
              borderRadius: 1, transition: "width 0.5s ease",
              boxShadow: batchInfo.pct > 80 ? "0 0 6px #00d4ff80" : "none" }} />
          </Box>
          <Typography sx={{ ...mono, fontSize: "0.68rem", color: "#00d4ff", flexShrink: 0 }}>
            {batchInfo.pct}%
          </Typography>
          {batchInfo.box && (
            <Typography sx={{ ...mono, fontSize: "0.65rem", color: "#7d8590", flexShrink: 0 }}>
              box <span style={{color:"#a5d6ff"}}>{batchInfo.box}</span>
              &nbsp; cls <span style={{color:"#a5d6ff"}}>{batchInfo.cls}</span>
              &nbsp; dfl <span style={{color:"#a5d6ff"}}>{batchInfo.dfl}</span>
            </Typography>
          )}
        </Box>
      )}

      <Box sx={{ mb: 3 }} />

      {/* Live Metrics Panel */}
      {running && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ mb: 1.5 }}>
            <TextField label="Run Directory (for live metrics)" size="small" fullWidth
              placeholder="e.g. C:\Users\moham\runs\detect\runs\train\dronesentinel_train_A"
              value={runDir} onChange={(e) => setRunDir(e.target.value)}
              InputLabelProps={{ shrink: true }} inputProps={{ autoComplete: "off" }}
              sx={{ "& input": { ...mono, fontSize: "0.74rem" } }} />
          </Box>
          <Grid container spacing={1.5}>
            <Grid item xs={12} md={4}><MetricCard title="last.pt  —  Latest Epoch" data={liveMetrics?.last} color="#ffb300" /></Grid>
            <Grid item xs={12} md={4}><MetricCard title="best.pt  —  Best So Far"  data={liveMetrics?.best} color="#00e676" /></Grid>
            <Grid item xs={12} md={4}><HWCard hw={liveMetrics?.hw} /></Grid>
          </Grid>
        </Box>
      )}

      {/* ── Core Config ── */}
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={6}>
          <SectionPanel title="Dataset & Model">
            <Box sx={{ mb: 1.5 }}><Field label="Data YAML Path" value={cfg.data_yaml} onChange={h.data_yaml} tooltip="Full path to your data.yaml file" /></Box>
            <FormControl fullWidth size="small" sx={{ mb: isCustomModel ? 0.5 : 1.5 }}>
              <InputLabel sx={{ ...mono, fontSize: "0.8rem" }}>Base Model</InputLabel>
              <Select
                value={isCustomModel ? "__custom__" : cfg.model}
                label="Base Model"
                onChange={(e) => {
                  const val = e.target.value;
                  h.model({ target: { value: val === "__custom__" ? "" : val } });
                }}
                sx={{ ...mono, fontSize: "0.82rem" }}
              >
                {MODELS.map(({ value, label }) => (
                  <MenuItem key={value} value={value} sx={{ ...mono, fontSize: "0.8rem" }}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {isCustomModel && (
              <Box sx={{ mb: 1.5 }}>
                <Field
                  label="Model path or name"
                  value={cfg.model}
                  onChange={h.model}
                  tooltip="Full path to a .pt or .engine file, or any Ultralytics model name (e.g. runs/train/best.pt)"
                />
              </Box>
            )}
            <Box sx={{ mb: 1.5 }}><Field label="Run Name"          value={cfg.name}    onChange={h.name}    tooltip="Folder name for this training run" /></Box>
            <Field                        label="Project Directory" value={cfg.project} onChange={h.project} tooltip="Root folder where runs are saved" />
          </SectionPanel>
        </Grid>

        <Grid item xs={12} md={6}>
          <SectionPanel title="Core Hyperparameters">
            <Typography sx={{ ...mono, fontSize: "0.65rem", color: "#7d8590", mb: 1.5 }}>
              Toggle to include / exclude optional params from the command
            </Typography>
            <Grid container spacing={1.5}>
              <Grid item xs={6}><Box sx={{ mb: 1.5 }}><Field label="Epochs"     value={cfg.epochs} onChange={h.epochs} type="number" tooltip="Full passes over dataset" /></Box></Grid>
              <Grid item xs={6}><Box sx={{ mb: 1.5 }}><Field label="Image Size" value={cfg.imgsz}  onChange={h.imgsz}  type="number" tooltip="Input image size (640 recommended)" /></Box></Grid>
              <Grid item xs={6}><Box sx={{ mb: 1.5 }}><Field label="Batch Size" value={cfg.batch}  onChange={h.batch}  type="number" tooltip="Images per batch (12 for RTX 4050)" /></Box></Grid>
            </Grid>
            <ToggledField label="Patience"   value={cfg.patience} onChange={h.patience} enabled={enabled.patience} onToggle={th.patience} type="number" tooltip="Early stopping — stop if no improvement after N epochs" />
            <ToggledField label="Workers"    value={cfg.workers}  onChange={h.workers}  enabled={enabled.workers}  onToggle={th.workers}  type="number" tooltip="Dataloader workers (4 recommended on Windows)" />
            <ToggledField label="LR (lr0)"   value={cfg.lr0}      onChange={h.lr0}      enabled={enabled.lr0}      onToggle={th.lr0}      type="number" tooltip="Initial learning rate" />
            <ToggledField label="Mosaic"     value={cfg.mosaic}   onChange={h.mosaic}   enabled={enabled.mosaic}   onToggle={th.mosaic}   type="number" tooltip="Mosaic augmentation probability (0–1)" />
            <ToggledField label="Device"     value={cfg.device}   onChange={h.device}   enabled={enabled.device}   onToggle={th.device}             tooltip="0 = GPU, cpu = CPU-only" />
          </SectionPanel>
        </Grid>
      </Grid>

      {/* ── Advanced Parameters ── */}
      <SectionPanel title="Advanced Parameters  ·  toggle to add to command">
        <Typography sx={{ ...mono, fontSize: "0.62rem", color: "#7d8590", mb: 2, letterSpacing: "0.04em" }}>
          All off by default — enable only what you need. Any parameter not shown here can be added directly in the command box below.
        </Typography>
        <Grid container spacing={0}>
          <Grid item xs={12} md={6} sx={{ pr: { md: 2 } }}>
            <ToggledField label="deterministic (True/False)" value={cfg.deterministic} onChange={h.deterministic}
              enabled={enabled.deterministic} onToggle={th.deterministic}
              tooltip="False = faster training, allows non-deterministic CUDA ops. True = reproducible but slower." />
            <ToggledField label="amp (True/False)" value={cfg.amp} onChange={h.amp}
              enabled={enabled.amp} onToggle={th.amp}
              tooltip="Automatic Mixed Precision — True speeds up training on modern GPUs" />
            <ToggledField label="optimizer" value={cfg.optimizer} onChange={h.optimizer}
              enabled={enabled.optimizer} onToggle={th.optimizer}
              tooltip="auto, SGD, Adam, AdamW, NAdam, RAdam, RMSProp" />
            <ToggledField label="lrf (final LR factor)" value={cfg.lrf} onChange={h.lrf}
              enabled={enabled.lrf} onToggle={th.lrf} type="number"
              tooltip="Final learning rate = lr0 × lrf (cosine decay endpoint)" />
            <ToggledField label="weight_decay" value={cfg.weight_decay} onChange={h.weight_decay}
              enabled={enabled.weight_decay} onToggle={th.weight_decay} type="number"
              tooltip="L2 regularization — default 0.0005" />
            <ToggledField label="dropout" value={cfg.dropout} onChange={h.dropout}
              enabled={enabled.dropout} onToggle={th.dropout} type="number"
              tooltip="Dropout rate for classification head (0.0 = disabled)" />
          </Grid>
          <Grid item xs={12} md={6} sx={{ pl: { md: 2 } }}>
            <ToggledField label="iou (NMS threshold)" value={cfg.iou} onChange={h.iou}
              enabled={enabled.iou} onToggle={th.iou} type="number"
              tooltip="IoU threshold for NMS during validation — default 0.7" />
            <ToggledField label="close_mosaic (final N epochs)" value={cfg.close_mosaic} onChange={h.close_mosaic}
              enabled={enabled.close_mosaic} onToggle={th.close_mosaic} type="number"
              tooltip="Disable mosaic augmentation for the last N epochs — default 10" />
            <ToggledField label="seed" value={cfg.seed} onChange={h.seed}
              enabled={enabled.seed} onToggle={th.seed} type="number"
              tooltip="Random seed for reproducibility — default 0" />
            <ToggledField label="exist_ok (True/False)" value={cfg.exist_ok} onChange={h.exist_ok}
              enabled={enabled.exist_ok} onToggle={th.exist_ok}
              tooltip="True = overwrite existing run folder with same name" />
          </Grid>
        </Grid>
      </SectionPanel>

      {/* ── Resume ── */}
      <SectionPanel title="Resume Training">
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
          <TextField label="Path to last.pt" size="small" fullWidth value={resumePath}
            onChange={(e) => setResumePath(e.target.value)}
            InputLabelProps={{ shrink: true }} inputProps={{ autoComplete: "off" }}
            sx={{ "& input": { ...mono, fontSize: "0.78rem" } }} />
          <Button variant="contained" onClick={handleResume} disabled={running}
            sx={{ bgcolor: "#00d4ff", color: "#000", fontWeight: 700, whiteSpace: "nowrap", minWidth: 110,
              "&:hover": { bgcolor: "#00a8cc" }, "&.Mui-disabled": { bgcolor: "#00d4ff30", color: "#7d8590" } }}>
            ⟳ Resume
          </Button>
        </Box>
      </SectionPanel>

      {/* ── #8 Load Config from Previous Run ── */}
      <SectionPanel title="Load Config from Previous Run">
        <Typography sx={{ ...mono, fontSize: "0.65rem", color: "#7d8590", mb: 1.5 }}>
          Enter the full path to an <span style={{ color: "#79c0ff" }}>args.yaml</span> from a previous run — the fields above will be populated.
        </Typography>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
          <TextField label="Path to args.yaml" size="small" fullWidth value={loadRunDir}
            onChange={(e) => setLoadRunDir(e.target.value)}
            placeholder='e.g. C:\Users\...\runs\train\dronesentinel_train3\args.yaml'
            InputLabelProps={{ shrink: true }} inputProps={{ autoComplete: "off" }}
            sx={{ "& input": { ...mono, fontSize: "0.75rem" } }} />
          <Button variant="contained" onClick={handleLoadConfig}
            disabled={loadingConfig || !loadRunDir.trim()}
            sx={{ bgcolor: "#ffb300", color: "#000", fontWeight: 700, whiteSpace: "nowrap", minWidth: 120,
              "&:hover": { bgcolor: "#e6a000" }, "&.Mui-disabled": { bgcolor: "#ffb30030", color: "#7d8590" } }}>
            {loadingConfig ? "…" : "↺ Load Config"}
          </Button>
        </Box>
        {loadMsg && (
          <Typography sx={{ ...mono, fontSize: "0.7rem", mt: 0.75,
            color: loadMsg.startsWith("✓") ? "#00e676" : "#ff6b35" }}>
            {loadMsg}
          </Typography>
        )}
      </SectionPanel>

      {/* ── Editable Train Command ── */}
      <SectionPanel title="YOLO Train Command  ·  edit to sync fields">
        <Typography sx={{ ...mono, fontSize: "0.62rem", color: "#7d8590", mb: 1, letterSpacing: "0.04em" }}>
          Fields → command auto-updates.  Edit command directly → fields sync back.
          Add any extra YOLO parameter not shown in the UI directly here (e.g. <span style={{color:"#79c0ff"}}>fliplr=0.5 hsv_h=0.015</span>).
        </Typography>
        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
          <Box sx={{ flex: 1 }}>
            <EditableCmd value={trainCmd} onChange={handleTrainCmdChange} color="#ffb300" label="yolo train …" />
          </Box>
          <CopyBtn text={trainCmd} copied={copied} onCopy={handleCopy} />
        </Box>
      </SectionPanel>

      {/* Start / Stop */}
      <Box sx={{ display: "flex", gap: 1.5, mb: 2.5 }}>
        <Button variant="contained" onClick={handleStart} disabled={running}
          sx={{ bgcolor: "#00e676", color: "#000", fontWeight: 700,
            "&:hover": { bgcolor: "#00c853" }, "&.Mui-disabled": { bgcolor: "#00e67630", color: "#7d8590" }, flex: 1 }}>
          ▶ Start Training
        </Button>
        <Button variant="contained" onClick={handleStop} disabled={!running}
          sx={{ bgcolor: "#ff3d3d", color: "#fff", "&:hover": { bgcolor: "#d32f2f" },
            "&.Mui-disabled": { bgcolor: "#ff3d3d30", color: "#7d8590" } }}>
          ■ Stop
        </Button>
      </Box>

      <LogPanel lines={log} height={320} forwardRef={logRef} />

      {/* ── Epoch Timing Log ── */}
      {epochLog.length > 0 && (
        <Box sx={{ mt: 2, mb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Typography sx={{ ...mono, fontSize: "0.65rem", color: "#7d8590", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Epoch Timing Log
            </Typography>
            <Typography sx={{ ...mono, fontSize: "0.62rem", color: "#7d8590" }}>
              {epochLog.filter(e => e.end).length} / {epochInfo.total || epochLog.length} completed
            </Typography>
          </Box>
          <Box sx={{ bgcolor: "#0d1117", border: "1px solid #1c2333", borderRadius: 1, overflow: "hidden" }}>
            {/* Header */}
            <Box sx={{ display: "grid", gridTemplateColumns: "52px 1fr 1fr 1fr", px: 1.5, py: 0.8,
              bgcolor: "#161b22", borderBottom: "1px solid #1c2333" }}>
              {["Epoch","Start","End","Duration"].map(h => (
                <Typography key={h} sx={{ ...mono, fontSize: "0.62rem", color: "#7d8590", letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</Typography>
              ))}
            </Box>
            {/* Rows — newest first, cap at 100 rows */}
            <Box sx={{ maxHeight: 260, overflowY: "auto" }}>
              {[...epochLog].sort((a,b) => b.epoch - a.epoch).slice(0,100).map(e => {
                const done = !!e.end;
                const durStr = e.elapsedSec == null ? "—"
                  : `${String(Math.floor(e.elapsedSec/60)).padStart(2,"0")}:${String(e.elapsedSec%60).padStart(2,"0")}`;
                return (
                  <Box key={e.epoch} sx={{ display: "grid", gridTemplateColumns: "52px 1fr 1fr 1fr",
                    px: 1.5, py: 0.7, borderBottom: "1px solid #161b22",
                    bgcolor: done ? "transparent" : "#0d1f0d",
                    "&:last-child": { borderBottom: "none" } }}>
                    <Typography sx={{ ...mono, fontSize: "0.68rem", color: done ? "#e6edf3" : "#ffb300", fontWeight: done ? 400 : 700 }}>
                      {e.epoch}{!done && <span style={{color:"#ffb30080", fontSize:"0.6rem"}}> ●</span>}
                    </Typography>
                    <Typography sx={{ ...mono, fontSize: "0.68rem", color: "#a5d6ff" }}>{e.start}</Typography>
                    <Typography sx={{ ...mono, fontSize: "0.68rem", color: done ? "#a5d6ff" : "#7d8590" }}>{e.end ?? "running…"}</Typography>
                    <Typography sx={{ ...mono, fontSize: "0.68rem", color: done ? "#00e676" : "#7d8590" }}>{durStr}</Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Box>
      )}

      {/* ── Evaluate on Dataset ── */}
      <Box sx={{ mt: 3 }}>
        <SectionPanel title="Evaluate on Dataset">
          <Box sx={{ mb: 1.5, px: 2, py: 1, bgcolor: "#020408", border: "1px solid #1c2333",
            borderLeft: `3px solid ${evalRunning ? "#bd93f9" : "#1c2333"}`,
            display: "flex", alignItems: "center", gap: 2 }}>
            <Box sx={{ width: 7, height: 7, borderRadius: "50%",
              bgcolor: evalRunning ? "#bd93f9" : "#7d8590",
              boxShadow: evalRunning ? "0 0 7px #bd93f9" : "none",
              animation: evalRunning ? "pulse 1.5s infinite" : "none" }} />
            <Typography sx={{ ...mono, fontSize: "0.72rem", color: evalRunning ? "#bd93f9" : "#7d8590",
              letterSpacing: "0.1em", textTransform: "uppercase" }}>
              {evalRunning ? "Evaluating…" : "Idle"}
            </Typography>
          </Box>

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={6}>
              <TextField label="Data YAML Path" size="small" fullWidth value={evalCfg.data_yaml} onChange={eh("data_yaml")}
                placeholder='D:\...\data.yaml' InputLabelProps={{ shrink: true }} inputProps={{ autoComplete: "off" }}
                sx={{ mb: 1.5, "& input": { ...mono, fontSize: "0.75rem" } }} />
              <TextField label="Model Path (best.pt / last.pt)" size="small" fullWidth value={evalCfg.model_pt} onChange={eh("model_pt")}
                placeholder='C:\Users\...\weights\best.pt' InputLabelProps={{ shrink: true }} inputProps={{ autoComplete: "off" }}
                sx={{ "& input": { ...mono, fontSize: "0.75rem" } }} />
            </Grid>
            <Grid item xs={12} md={6}>
              <Grid container spacing={1.5}>
                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel sx={{ ...mono, fontSize: "0.8rem" }}>Split</InputLabel>
                    <Select value={evalCfg.split} label="Split" onChange={eh("split")} sx={{ ...mono, fontSize: "0.8rem" }}>
                      {["test","val","train"].map(s => <MenuItem key={s} value={s} sx={{ ...mono, fontSize: "0.8rem" }}>{s}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={3}>
                  <TextField label="Img Size" size="small" fullWidth type="number" value={evalCfg.imgsz} onChange={eh("imgsz")} InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid item xs={3}>
                  <TextField label="Device" size="small" fullWidth value={evalCfg.device} onChange={eh("device")} InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Switch size="small" checked={evalCfg.save_json}
                      onChange={(e) => setEvalCfg(p => ({ ...p, save_json: e.target.checked }))}
                      sx={{ "& .MuiSwitch-switchBase.Mui-checked": { color: "#bd93f9" },
                            "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: "#bd93f940" } }} />
                    <Typography sx={{ ...mono, fontSize: "0.72rem", color: "#7d8590" }}>save_json</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Switch size="small" checked={evalCfg.save_txt}
                      onChange={(e) => setEvalCfg(p => ({ ...p, save_txt: e.target.checked }))}
                      sx={{ "& .MuiSwitch-switchBase.Mui-checked": { color: "#bd93f9" },
                            "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: "#bd93f940" } }} />
                    <Typography sx={{ ...mono, fontSize: "0.72rem", color: "#7d8590" }}>save_txt</Typography>
                  </Box>
                </Grid>
              </Grid>
            </Grid>
          </Grid>

          <Typography sx={{ ...mono, fontSize: "0.62rem", color: "#7d8590", mb: 0.8, letterSpacing: "0.04em" }}>
            Edit fields → command updates.  Edit command → fields sync. Add extra params directly in the command box.
          </Typography>
          <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", mb: 2 }}>
            <Box sx={{ flex: 1 }}>
              <EditableCmd value={evalCmd} onChange={handleEvalCmdChange} color="#bd93f9" label="yolo val …" />
            </Box>
            <CopyBtn text={evalCmd} copied={evalCopied} onCopy={handleEvalCopy} />
          </Box>

          <Box sx={{ display: "flex", gap: 1.5, mb: 2 }}>
            <Button variant="contained" onClick={handleEvalStart} disabled={evalRunning}
              sx={{ bgcolor: "#bd93f9", color: "#000", fontWeight: 700, flex: 1,
                "&:hover": { bgcolor: "#a97fe8" }, "&.Mui-disabled": { bgcolor: "#bd93f930", color: "#7d8590" } }}>
              ▶ Run Evaluation
            </Button>
            <Button variant="contained" onClick={handleEvalStop} disabled={!evalRunning}
              sx={{ bgcolor: "#ff3d3d", color: "#fff", "&:hover": { bgcolor: "#d32f2f" },
                "&.Mui-disabled": { bgcolor: "#ff3d3d30", color: "#7d8590" } }}>
              ■ Stop
            </Button>
          </Box>

          <LogPanel lines={evalLog} height={220} forwardRef={evalLogRef} />
        </SectionPanel>
      </Box>
    </Box>
  );
}
