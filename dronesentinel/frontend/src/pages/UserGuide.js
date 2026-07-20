import React, { useState } from "react";
import { Box, Typography, Chip } from "@mui/material";
import { PageHeader, SectionPanel } from "../components";
import logoImg from "../assets/logo.png";

/* ── small reusable helpers ─────────────────────────────── */

function Step({ n, children }) {
  return (
    <Box sx={{ display: "flex", gap: 2, mb: 1.5 }}>
      <Box sx={{
        minWidth: 24, height: 24, borderRadius: "50%",
        bgcolor: "#00d4ff15", border: "1px solid #00d4ff40",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: '"IBM Plex Mono", monospace', fontSize: "0.68rem",
        color: "#00d4ff", flexShrink: 0, mt: "1px",
      }}>
        {n}
      </Box>
      <Typography sx={{
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: "0.8rem", color: "#c9d1d9", lineHeight: 1.8,
      }}>
        {children}
      </Typography>
    </Box>
  );
}

function Note({ children, color = "#ffb300" }) {
  return (
    <Box sx={{
      display: "flex", gap: 1.5, mt: 1, mb: 1.5,
      px: 2, py: 1.2,
      bgcolor: `${color}0d`,
      border: `1px solid ${color}30`,
      borderLeft: `3px solid ${color}`,
    }}>
      <Typography sx={{
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: "0.75rem", color: `${color}cc`, lineHeight: 1.7,
      }}>
        {children}
      </Typography>
    </Box>
  );
}

function Code({ children }) {
  return (
    <Box component="code" sx={{
      display: "inline-block",
      px: 1, py: 0.2,
      bgcolor: "#161b22",
      border: "1px solid #1c2333",
      borderRadius: "3px",
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: "0.75rem",
      color: "#79c0ff",
    }}>
      {children}
    </Box>
  );
}

function ParamRow({ param, type, default: def, desc }) {
  return (
    <Box sx={{
      display: "grid",
      gridTemplateColumns: "140px 80px 90px 1fr",
      gap: 1.5, py: 1,
      borderBottom: "1px solid #1c2333",
      alignItems: "start",
    }}>
      <Code>{param}</Code>
      <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.72rem", color: "#7d8590" }}>{type}</Typography>
      <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.72rem", color: "#00e676" }}>{def}</Typography>
      <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.75rem", color: "#c9d1d9" }}>{desc}</Typography>
    </Box>
  );
}

/* ── section data ───────────────────────────────────────── */
const SECTIONS = [
  { id: "overview",     label: "Overview" },
  { id: "setup",        label: "First-Time Setup" },
  { id: "roles",        label: "Roles & Access" },
  { id: "detection",    label: "Running Detection" },
  { id: "gpu-decode",   label: "GPU RTSP Decoding" },
  { id: "training",     label: "Training a Model" },
  { id: "params",       label: "Training Parameters" },
  { id: "resume",       label: "Resuming Training" },
  { id: "dashboard",    label: "Dashboard & Analytics" },
  { id: "settings",     label: "Settings Tab" },
  { id: "troubleshoot", label: "Troubleshooting" },
  { id: "camera",       label: "Camera Requirements" },
  { id: "tips",         label: "Tips & Troubleshooting" },
];

export default function UserGuide() {
  const [active, setActive] = useState("overview");

  const scrollTo = (id) => {
    setActive(id);
    document.getElementById("guide-" + id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Box sx={{ display: "flex", p: 3, gap: 3, maxWidth: 1100 }}>

      {/* ── Left nav ── */}
      <Box sx={{ width: 170, flexShrink: 0, position: "sticky", top: 72, alignSelf: "flex-start" }}>
        <Typography sx={{
          fontFamily: '"IBM Plex Mono", monospace', fontSize: "0.62rem",
          color: "#7d8590", letterSpacing: "0.15em", textTransform: "uppercase", mb: 1.5,
        }}>
          Contents
        </Typography>
        {SECTIONS.map(({ id, label }) => (
          <Box key={id} onClick={() => scrollTo(id)} sx={{
            px: 1.5, py: 0.75, mb: 0.25, cursor: "pointer", borderRadius: 1,
            borderLeft: active === id ? "2px solid #00d4ff" : "2px solid transparent",
            bgcolor: active === id ? "#00d4ff10" : "transparent",
            transition: "all 0.15s",
            "&:hover": { bgcolor: "#1c233340" },
          }}>
            <Typography sx={{
              fontFamily: '"IBM Plex Mono", monospace', fontSize: "0.73rem",
              color: active === id ? "#00d4ff" : "#7d8590",
            }}>
              {label}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* ── Main content ── */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* ── Hero logo ── */}
        <Box sx={{
          display: "flex", flexDirection: "column", alignItems: "center",
          mb: 4, mt: 1,
        }}>
          <Box
            component="img"
            src={logoImg}
            alt="DroneSentinel"
            sx={{
              width: 180, height: 180,
              borderRadius: "50%",
              objectFit: "cover",
              objectPosition: "center",
              border: "2px solid #00d4ff30",
              boxShadow: "0 0 40px #00d4ff25, 0 0 80px #00d4ff10",
              mb: 2,
            }}
          />
          <Typography sx={{
            fontFamily: '"IBM Plex Sans", sans-serif',
            fontSize: "1.5rem", fontWeight: 700,
            color: "#e6edf3", letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}>
            DroneSentinel
          </Typography>
          <Typography sx={{
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: "0.68rem", color: "#7d8590",
            letterSpacing: "0.15em", textTransform: "uppercase", mt: 0.5,
          }}>
            AI Drone Detection Platform · YOLOv26s · BoT-SORT · AES-256
          </Typography>
        </Box>
        <PageHeader icon="◷" title="User Guide" subtitle="DroneSentinel · YOLOv26s Drone Detection Platform" />

        {/* ═══ OVERVIEW ═══ */}
        <Box id="guide-overview">
          <SectionPanel title="Overview">
            <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.8rem", color: "#c9d1d9", lineHeight: 1.9, mb: 1.5 }}>
              DroneSentinel is an AI-powered drone detection and tracking platform built for real-time
              surveillance. It uses <strong style={{ color: "#00d4ff" }}>YOLOv26s</strong> (a custom
              fine-tuned end-to-end detection model) combined with{" "}
              <strong style={{ color: "#00d4ff" }}>BoT-SORT</strong> tracking to follow each drone
              across video frames and assign it a stable unique ID.
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
              {[
                { label: "Detection Model",   value: "YOLOv26s (custom fine-tuned)", color: "#00d4ff" },
                { label: "Tracker",           value: "BoT-SORT + Kalman Filter",     color: "#00d4ff" },
                { label: "Encryption",        value: "AES-256",                      color: "#00e676" },
                { label: "Backend",           value: "FastAPI + PyTorch + CUDA",     color: "#00e676" },
                { label: "Video Decode",      value: "NVDEC (GPU) / OpenCV (USB)",   color: "#ffb300" },
                { label: "Best mAP50",        value: "0.902  (90.2%)",               color: "#ffb300" },
              ].map(({ label, value, color }) => (
                <Box key={label} sx={{ px: 2, py: 1.2, bgcolor: "#080c10", border: "1px solid #1c2333" }}>
                  <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.65rem", color: "#7d8590", mb: 0.3 }}>{label}</Typography>
                  <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.82rem", color, fontWeight: 600 }}>{value}</Typography>
                </Box>
              ))}
            </Box>
          </SectionPanel>
        </Box>

        {/* ═══ FIRST-TIME SETUP ═══ */}
        <Box id="guide-setup" sx={{ mt: 1 }}>
          <SectionPanel title="First-Time Setup">
            <Note color="#ff6b35">
              ⚠  The first time DroneSentinel is opened, no admin account exists. You will be shown a
              setup form to create the initial administrator account before anything else can be accessed.
            </Note>
            <Step n="1">Open your browser and go to <Code>http://localhost:3000</Code>. You will land on the login page.</Step>
            <Step n="2">
              The page will show <strong style={{color:"#00d4ff"}}>"No admin account found. Create one to get started."</strong>{" "}
              Enter a strong password for the <Code>admin</Code> account and click{" "}
              <strong style={{color:"#00d4ff"}}>Create Admin Account</strong>.
            </Step>
            <Step n="3">
              After setup, you are redirected back to the login form. Sign in with username{" "}
              <Code>admin</Code> and the password you just created.
            </Step>
            <Step n="4">
              You are now logged in as <strong style={{color:"#ff6b35"}}>Admin</strong>. You have access
              to all tabs. Navigate freely using the left sidebar.
            </Step>
            <Note color="#00d4ff">
              ℹ  Password requirements: minimum 8 characters, at least one uppercase letter (A–Z),
              one lowercase letter (a–z), one digit (0–9), and one special character (!@#$…).
              A live checklist is shown as you type.
            </Note>
            <Note color="#00e676">
              ✓  Credentials are stored as SHA-256 hashes inside an AES-256 encrypted file. Passwords
              are never stored in plain text anywhere on disk.
            </Note>
          </SectionPanel>
        </Box>

        {/* ═══ ROLES & ACCESS ═══ */}
        <Box id="guide-roles" sx={{ mt: 1 }}>
          <SectionPanel title="Roles & Access Control">
            <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.8rem", color: "#c9d1d9", lineHeight: 1.9, mb: 1.5 }}>
              DroneSentinel uses role-based access control (RBAC). Every user is assigned one of three
              roles when their account is created. The sidebar automatically shows only the tabs that
              the logged-in user is permitted to access.
            </Typography>

            {/* Role cards */}
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1.5, mb: 2 }}>
              {[
                {
                  role: "Admin", color: "#ff6b35",
                  tabs: ["Dashboard", "Detection", "Training", "Settings", "Troubleshooting", "User Guide"],
                  desc: "Full system access. Manages users, settings, exports, and all operational features.",
                },
                {
                  role: "Operator", color: "#00d4ff",
                  tabs: ["Dashboard", "Detection", "User Guide"],
                  desc: "Day-to-day surveillance operator. Monitors live detection and views analytics.",
                },
                {
                  role: "Technical", color: "#00e676",
                  tabs: ["Training", "Troubleshooting", "User Guide"],
                  desc: "ML / maintenance engineer. Trains models and runs diagnostics.",
                },
              ].map(({ role, color, tabs, desc }) => (
                <Box key={role} sx={{
                  px: 2, py: 1.5, bgcolor: "#080c10",
                  border: `1px solid ${color}30`,
                  borderTop: `2px solid ${color}`,
                }}>
                  <Chip label={role.toUpperCase()} size="small" sx={{
                    bgcolor: `${color}15`, color, border: `1px solid ${color}40`,
                    fontFamily: '"IBM Plex Mono"', fontSize: "0.62rem",
                    height: 18, mb: 1,
                  }} />
                  <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.72rem", color: "#c9d1d9", lineHeight: 1.7, mb: 1 }}>
                    {desc}
                  </Typography>
                  <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.62rem", color: "#7d8590", letterSpacing: "0.1em", textTransform: "uppercase", mb: 0.5 }}>
                    Accessible tabs
                  </Typography>
                  {tabs.map(t => (
                    <Typography key={t} sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.7rem", color, lineHeight: 1.8 }}>
                      ◈ {t}
                    </Typography>
                  ))}
                </Box>
              ))}
            </Box>

            <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.78rem", color: "#7d8590", mb: 0.75 }}>
              User management rules:
            </Typography>
            {[
              ["Only Admin can create users", "New accounts are created from Settings → User Management. There is no self-registration."],
              ["Only Admin can delete users", "Users can be removed from the same User Management panel. An admin cannot delete their own account."],
              ["Usernames are case-insensitive", "Logging in as 'Mohamed' or 'mohamed' resolves to the same account."],
              ["Username format", "3–32 characters. Letters, digits, underscore (_) and period (.) only. Cannot start or end with a period."],
            ].map(([term, def]) => (
              <Box key={term} sx={{ display: "flex", gap: 2, mb: 0.8 }}>
                <Code>{term}</Code>
                <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.75rem", color: "#c9d1d9" }}>{def}</Typography>
              </Box>
            ))}
            <Note color="#ffb300">
              ⚠  If a user with the wrong role tries to directly visit a restricted URL, they are
              automatically redirected to their first permitted tab. No access bypass is possible.
            </Note>
          </SectionPanel>
        </Box>

        {/* ═══ DETECTION ═══ */}
        <Box id="guide-detection" sx={{ mt: 1 }}>
          <SectionPanel title="Running Detection">
            <Step n="1">
              Go to the <strong style={{color:"#00d4ff"}}>Detection</strong> tab from the sidebar.
              (Available to Admin and Operator roles.)
            </Step>
            <Step n="2">
              In the <strong style={{color:"#e6edf3"}}>Model Path</strong> field, paste the full path to your trained
              model weights file (<Code>.pt</Code>). Example:{" "}
              <Code>D:\runs\yolo26s_drone_960_v1\weights\best.pt</Code>
            </Step>
            <Step n="3">
              In <strong style={{color:"#e6edf3"}}>Video Source</strong>, enter <Code>0</Code> for your
              default USB webcam, or paste an RTSP URL (e.g.{" "}
              <Code>rtsp://user:pass@192.168.1.64:554/stream</Code>) for an IP camera.
            </Step>
            <Step n="4">
              Set the <strong style={{color:"#e6edf3"}}>Confidence Threshold</strong> — a value between
              0 and 1. Lower values detect more drones but may produce false positives.{" "}
              <Code>0.25</Code> is a good starting point.
            </Step>
            <Step n="5">
              Click <strong style={{color:"#00e676"}}>▶ Start</strong>. The status indicator turns
              green when detection is active. The live video feed is streamed to the browser at
              2560×1440 resolution for operator clarity.
            </Step>
            <Step n="6">
              Click <strong style={{color:"#ff3d3d"}}>■ Stop</strong> to end the session. The
              recording is saved automatically and session data is available from the Dashboard.
            </Step>
            <Note color="#00d4ff">
              ℹ  USB cameras capture at 1920×1088. RTSP streams are decoded at the camera's native
              resolution. Both are upscaled to 2560×1440 for the live browser feed. YOLOv26s
              internally processes frames at 960×960 for inference.
            </Note>
            <Note color="#00d4ff">
              ℹ  If you enable Email Alerts, expand the Email Alerts panel and fill in your SMTP
              credentials. You can choose between instant per-detection alerts or a session summary
              email when you stop detection.
            </Note>
          </SectionPanel>
        </Box>

        {/* ═══ GPU RTSP DECODING ═══ */}
        <Box id="guide-gpu-decode" sx={{ mt: 1 }}>
          <SectionPanel title="GPU RTSP Decoding (NVDEC)">
            <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.8rem", color: "#c9d1d9", lineHeight: 1.9, mb: 1.5 }}>
              DroneSentinel decodes RTSP camera streams directly on your NVIDIA GPU using{" "}
              <strong style={{ color: "#00d4ff" }}>NVDEC</strong> (NVIDIA Video Decoder). This offloads
              video decoding from the CPU, leaving it free for other tasks.
            </Typography>
            <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.8rem", color: "#c9d1d9", lineHeight: 1.9, mb: 1 }}>
              The system automatically tries GPU decoding first when the source is an RTSP URL. If GPU
              decoding fails (e.g., USB webcam, unsupported codec, or missing NVDEC build), it falls
              back to CPU-based OpenCV decoding with no user action required.
            </Typography>
            <Note color="#00d4ff">
              ℹ  GPU decode requires OpenCV compiled with <Code>WITH_NVCUVID=ON</Code>. Check the
              Troubleshooting tab → System Check to verify <Code>NVCUVID in Build: YES</Code>.
            </Note>
            <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.78rem", color: "#7d8590", mt: 1.5, mb: 0.5 }}>
              Full video pipeline (RTSP path):
            </Typography>
            {[
              ["RTSP Stream",      "Camera sends H.264/H.265 video packets over TCP/WiFi/Ethernet."],
              ["NVDEC Decode",     "GPU hardware decoder converts compressed video into raw frames in GPU memory."],
              ["GPU → CPU",        "Decoded frames (BGRA, 4 channels) are downloaded from GPU to CPU memory."],
              ["BGRA → BGR",       "Frames converted from 4-channel BGRA to 3-channel BGR."],
              ["Upscale → 2560×1440", "Frames upscaled to display resolution for streaming to the browser and saving the recording."],
              ["YOLO → 960×960",   "YOLOv26s internally resizes frames to 960×960 for neural network inference. This is independent of display resolution."],
            ].map(([term, def]) => (
              <Box key={term} sx={{ display: "flex", gap: 2, mb: 0.8 }}>
                <Code>{term}</Code>
                <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.75rem", color: "#c9d1d9" }}>{def}</Typography>
              </Box>
            ))}
            <Note color="#ffb300">
              ⚠  NVDEC outputs 4-channel BGRA frames (not 3-channel BGR like CPU decoding). DroneSentinel
              handles this conversion automatically. If you write custom code using <Code>cv2.cudacodec</Code>,
              always check <Code>frame.shape[2] == 4</Code> and convert with{" "}
              <Code>cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)</Code>.
            </Note>
          </SectionPanel>
        </Box>

        {/* ═══ TRAINING ═══ */}
        <Box id="guide-training" sx={{ mt: 1 }}>
          <SectionPanel title="Training a Model">
            <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.8rem", color: "#c9d1d9", lineHeight: 1.9, mb: 1.5 }}>
              Training teaches YOLOv26s to recognise drones using your custom dataset. The model
              learns from thousands of labelled images and adjusts its internal weights to improve
              detection accuracy over many epochs. (Available to Admin and Technical roles.)
            </Typography>
            <Step n="1">Go to the <strong style={{color:"#00d4ff"}}>Training</strong> tab.</Step>
            <Step n="2">
              Fill in <strong style={{color:"#e6edf3"}}>Data YAML Path</strong> — this file tells the
              model where your images are and what classes to detect. Example:{" "}
              <Code>D:\datasets\drone_detector\data.yaml</Code>
            </Step>
            <Step n="3">
              Choose a <strong style={{color:"#e6edf3"}}>Base Model</strong> from the dropdown. Each
              variant trades speed for accuracy — see the table below.
            </Step>
            <Box sx={{ mb: 1.5 }}>
              {[
                { m: "yolo26n.pt", p: "~2.6M", note: "Fastest — good for low-end hardware" },
                { m: "yolo26s.pt", p: "~9.4M", note: "Small — our deployed model, balanced real-time use" },
                { m: "yolo26m.pt", p: "~20M",  note: "Medium — balanced accuracy/speed" },
                { m: "yolo26l.pt", p: "~25M",  note: "Large — highest accuracy, needs more VRAM" },
              ].map(({ m, p, note }) => (
                <Box key={m} sx={{
                  display: "grid", gridTemplateColumns: "160px 70px 1fr",
                  gap: 1.5, py: 0.8, borderBottom: "1px solid #1c2333", alignItems: "center",
                }}>
                  <Code>{m}</Code>
                  <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.72rem", color: "#7d8590" }}>{p} params</Typography>
                  <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.75rem", color: "#c9d1d9" }}>{note}</Typography>
                </Box>
              ))}
            </Box>
            <Step n="4">Set your Hyperparameters (see the Training Parameters section below).</Step>
            <Step n="5">
              Click <strong style={{color:"#00e676"}}>▶ Start Training</strong>. The amber progress
              bar and epoch counter will update in real time.
            </Step>
            <Step n="6">
              When training finishes, your best weights are saved automatically at:{" "}
              <Box sx={{ mt: 0.5 }}><Code>{"{project}/{name}/weights/best.pt"}</Code></Box>
            </Step>
            <Note color="#ffb300">
              ⚡  Training on a GPU is strongly recommended. On an NVIDIA RTX 4050 Laptop GPU,
              60 epochs over ~6,000 images at 960×960 takes approximately 2–3 hours.
            </Note>
          </SectionPanel>
        </Box>

        {/* ═══ TRAINING PARAMETERS ═══ */}
        <Box id="guide-params" sx={{ mt: 1 }}>
          <SectionPanel title="Training Parameters — Explained">
            <Box sx={{ mb: 1 }}>
              <Box sx={{
                display: "grid", gridTemplateColumns: "140px 80px 90px 1fr",
                gap: 1.5, py: 0.8, borderBottom: "1px solid #1c2333",
              }}>
                {["Parameter", "Type", "Our Value", "What it does"].map(h => (
                  <Typography key={h} sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.65rem", color: "#7d8590", letterSpacing: "0.1em", textTransform: "uppercase" }}>{h}</Typography>
                ))}
              </Box>
              <ParamRow param="epochs"   type="integer" default="60"        desc="Number of full passes through the entire dataset. More epochs = more learning, but risks overfitting. 60 was used for the deployed YOLOv26s model." />
              <ParamRow param="imgsz"    type="integer" default="960"       desc="Images are resized to this square (pixels) before being fed to the model. Use 960 to match the deployed YOLOv26s training resolution for best accuracy." />
              <ParamRow param="batch"    type="integer" default="64"        desc="How many images are processed at once per training step. Larger = faster but needs more VRAM. Reduce to 16 or 8 if you get out-of-memory errors." />
              <ParamRow param="model"    type="string"  default="yolo26s.pt" desc="Pre-trained base weights to start from. Transfer learning from a pre-trained model requires far fewer epochs than training from scratch." />
              <ParamRow param="data"     type="string"  default="data.yaml" desc="Path to your dataset config file. Defines training/validation image folders and the class list (in our case: just 'drone')." />
              <ParamRow param="name"     type="string"  default="yolo26s_drone_960_v1" desc="Name of the output folder where results, charts, and weights are saved." />
              <ParamRow param="project"  type="string"  default="runs/"     desc="Parent directory for all training runs. Each run creates a subfolder inside this." />
            </Box>
            <Note color="#00d4ff">
              ℹ  After training, YOLOv26s saves two weight files: <Code>best.pt</Code> (highest
              validation mAP during training) and <Code>last.pt</Code> (final epoch weights). Always
              use <Code>best.pt</Code> for detection.
            </Note>
            <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.78rem", color: "#7d8590", mt: 1.5, mb: 0.5 }}>
              Understanding the metrics shown during training:
            </Typography>
            {[
              ["mAP50",     "Mean Average Precision at IoU threshold 0.50. Our deployed model achieved 0.902 (90.2%). This is the primary accuracy metric."],
              ["mAP50-95",  "Stricter metric averaged across IoU 0.50–0.95. Our best: 0.556. Higher = better bounding box precision."],
              ["Precision", "Of all detections made, what fraction were correct drones. Our best: 0.936 (93.6%)."],
              ["Recall",    "Of all actual drones in the images, what fraction did the model find. Our best: 0.826 (82.6%)."],
              ["Loss",      "How wrong the model's predictions are. Should steadily decrease each epoch."],
            ].map(([term, def]) => (
              <Box key={term} sx={{ display: "flex", gap: 2, mb: 0.8 }}>
                <Code>{term}</Code>
                <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.75rem", color: "#c9d1d9" }}>{def}</Typography>
              </Box>
            ))}
          </SectionPanel>
        </Box>

        {/* ═══ RESUME ═══ */}
        <Box id="guide-resume" sx={{ mt: 1 }}>
          <SectionPanel title="Resuming an Interrupted Training">
            <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.8rem", color: "#c9d1d9", lineHeight: 1.9, mb: 1 }}>
              If training is interrupted (e.g. system restart, power cut), you can resume from the
              last saved checkpoint without losing your progress.
            </Typography>
            <Step n="1">Go to the <strong style={{color:"#00d4ff"}}>Training</strong> tab.</Step>
            <Step n="2">
              In the <strong style={{color:"#e6edf3"}}>Resume Training</strong> panel, paste the path
              to your <Code>last.pt</Code> file. This is saved automatically every epoch inside your
              run's <Code>weights/</Code> folder.
            </Step>
            <Step n="3">
              Click <strong style={{color:"#00d4ff"}}>⟳ Resume</strong>. Training will continue from
              the exact epoch it stopped at — no epochs are wasted.
            </Step>
            <Note color="#ffb300">
              ⚠  Do not use <Code>best.pt</Code> for resuming — it only contains weights, not the
              full training state. Always resume with <Code>last.pt</Code>.
            </Note>
          </SectionPanel>
        </Box>

        {/* ═══ DASHBOARD ═══ */}
        <Box id="guide-dashboard" sx={{ mt: 1 }}>
          <SectionPanel title="Dashboard & Analytics">
            <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.8rem", color: "#c9d1d9", lineHeight: 1.9, mb: 1 }}>
              The Dashboard gives you a live overview of detection performance.
              (Available to Admin and Operator roles.)
            </Typography>
            {[
              ["Total Drones",    "#00d4ff", "Cumulative count of unique drones detected across the session."],
              ["Active Tracks",   "#00e676", "Number of drones currently being tracked in the latest frame."],
              ["Avg Confidence",  "#ffb300", "Average YOLOv26s confidence score across all detections (0–1). Higher is better."],
              ["Alerts Sent",     "#ff6b35", "Number of email alerts dispatched during this session."],
            ].map(([label, color, desc]) => (
              <Box key={label} sx={{ display: "flex", gap: 2, mb: 1, alignItems: "flex-start" }}>
                <Chip label={label} size="small" sx={{
                  bgcolor: `${color}15`, color, border: `1px solid ${color}40`,
                  fontFamily: '"IBM Plex Mono"', fontSize: "0.65rem",
                  height: 20, flexShrink: 0,
                }} />
                <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.75rem", color: "#c9d1d9" }}>{desc}</Typography>
              </Box>
            ))}
            <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.78rem", color: "#7d8590", mt: 1.5, mb: 0.5 }}>Export formats (available from the Settings tab):</Typography>
            {[
              ["CSV",  "Spreadsheet of all detection events with timestamps, confidence, and track IDs."],
              ["JSON", "Machine-readable full session data — useful for further analysis or integration."],
              ["PDF",  "Formatted summary report suitable for presenting or archiving."],
              ["HTML", "Dark-themed interactive report — same data as PDF, opens in any browser."],
            ].map(([fmt, desc]) => (
              <Box key={fmt} sx={{ display:"flex", gap:2, mb:0.8 }}>
                <Code>{fmt}</Code>
                <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize:"0.75rem", color:"#c9d1d9" }}>{desc}</Typography>
              </Box>
            ))}
          </SectionPanel>
        </Box>

        {/* ═══ SETTINGS TAB ═══ */}
        <Box id="guide-settings" sx={{ mt: 1 }}>
          <SectionPanel title="Settings Tab">
            <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.8rem", color: "#c9d1d9", lineHeight: 1.9, mb: 1 }}>
              The <strong style={{ color: "#00d4ff" }}>Settings</strong> tab is only accessible to
              the <strong style={{ color: "#ff6b35" }}>Admin</strong> role. It provides full system
              control: security, data export, runtime configuration, and user management.
            </Typography>

            <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.78rem", color: "#7d8590", mt: 1, mb: 0.75 }}>
              Security section:
            </Typography>
            {[
              ["Change Password",           "Update your own account password. Requires entering your current password. The new password must meet the full password policy."],
              ["View Audit Log",            "Shows a timestamped log of all significant actions: logins, failed attempts, user creation/deletion, settings changes, and exports."],
              ["Detection Sessions History","Lists past detection sessions with their timestamps and drone counts."],
            ].map(([term, def]) => (
              <Box key={term} sx={{ display: "flex", gap: 2, mb: 0.8 }}>
                <Code>{term}</Code>
                <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.75rem", color: "#c9d1d9" }}>{def}</Typography>
              </Box>
            ))}

            <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.78rem", color: "#7d8590", mt: 1.5, mb: 0.75 }}>
              Application Settings section:
            </Typography>
            <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.78rem", color: "#c9d1d9", lineHeight: 1.8, mb: 1 }}>
              Lists all runtime configuration values loaded from the encrypted backend config. You can
              edit and save them directly from the UI without restarting the backend.
            </Typography>

            <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.78rem", color: "#7d8590", mt: 1.5, mb: 0.75 }}>
              User Management section:
            </Typography>
            {[
              ["Add User",    "Create a new account with a chosen username, password, and role (Admin / Operator / Technical). Only Admin can do this — there is no self-registration."],
              ["Delete User", "Remove a user permanently. You cannot delete your own account."],
              ["Role column", "Displays the role assigned to each user with a colour-coded badge."],
            ].map(([term, def]) => (
              <Box key={term} sx={{ display: "flex", gap: 2, mb: 0.8 }}>
                <Code>{term}</Code>
                <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.75rem", color: "#c9d1d9" }}>{def}</Typography>
              </Box>
            ))}

            <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.78rem", color: "#7d8590", mt: 1.5, mb: 0.75 }}>
              Export Data section:
            </Typography>
            <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.78rem", color: "#c9d1d9", lineHeight: 1.8 }}>
              Click <Code>Lock Snapshot</Code> to capture the current analytics state, then download
              it in CSV, JSON, PDF, or HTML format. A snapshot must be locked before export buttons
              become active.
            </Typography>

            <Note color="#ff3d3d">
              ⚠  If you lose access to all admin accounts, you can reset by deleting the encrypted
              user file and restarting the backend (it will prompt for first-time setup again):{" "}
              <Code>del config\users.dat</Code> — then refresh the browser.
              All other settings and data remain intact.
            </Note>
          </SectionPanel>
        </Box>

        {/* ═══ TROUBLESHOOTING TAB ═══ */}
        <Box id="guide-troubleshoot" sx={{ mt: 1 }}>
          <SectionPanel title="Troubleshooting">
            <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.8rem", color: "#c9d1d9", lineHeight: 1.9, mb: 1.5 }}>
              The <strong style={{ color: "#00d4ff" }}>Troubleshooting</strong> tab provides built-in
              diagnostics to identify issues without leaving the browser.
              (Available to Admin and Technical roles.)
            </Typography>
            <Step n="1">
              <strong style={{color:"#e6edf3"}}>System Check</strong> runs automatically when you open
              the tab. It verifies Python, OpenCV, CUDA, NVDEC, PyTorch, and GPU availability. All
              items should show <strong style={{color:"#00e676"}}>YES</strong> for optimal performance.
            </Step>
            <Step n="2">
              <strong style={{color:"#e6edf3"}}>Camera Network Test</strong> — enter your camera's IP
              address and click Ping. Measures WiFi/Ethernet latency. Under 10ms is excellent;
              over 50ms indicates network issues that will limit effective FPS.
            </Step>
            <Step n="3">
              <strong style={{color:"#e6edf3"}}>Pipeline Benchmark</strong> — enter your RTSP URL and
              optionally your model path (<Code>.pt</Code>). Click Run Benchmark to measure every
              stage of the detection pipeline and identify the bottleneck automatically.
            </Step>
            <Note color="#00d4ff">
              ℹ  The benchmark works best when the camera is connected and streaming. Without a model
              path, only the decode pipeline is tested (no inference measurement).
            </Note>
          </SectionPanel>
        </Box>

        {/* ═══ CAMERA REQUIREMENTS ═══ */}
        <Box id="guide-camera" sx={{ mt: 1 }}>
          <SectionPanel title="Camera Requirements">
            <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.8rem", color: "#c9d1d9", lineHeight: 1.9, mb: 1 }}>
              DroneSentinel supports both USB webcams and IP cameras with RTSP streaming.
              For best results:
            </Typography>
            {[
              ["USB webcam",       "Plug-and-play. Enter source 0 in Detection. Captures at 1920×1088; upscaled to 2560×1440 for display. CPU-decoded via OpenCV."],
              ["RTSP / IP camera", "Enter the full RTSP URL as the source. Decoded on GPU via NVDEC when available."],
              ["H.265 / H.264",    "H.265 (HEVC) is preferred — lower bandwidth, same quality. H.264 also works with both GPU and CPU decoding."],
              ["25–30 fps",        "Higher frame rate = more frames for detection. 20fps is the minimum; 25–30fps is ideal."],
              ["Ethernet (PoE)",   "Strongly recommended for IP cameras. WiFi adds 20–60ms jitter that caps effective FPS. Ethernet eliminates this."],
              ["Resolution",       "1920×1080 is ideal. YOLO internally processes at 960×960 regardless of input resolution — higher than 1080p offers no detection benefit."],
            ].map(([term, def]) => (
              <Box key={term} sx={{ display: "flex", gap: 2, mb: 0.8 }}>
                <Code>{term}</Code>
                <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.75rem", color: "#c9d1d9" }}>{def}</Typography>
              </Box>
            ))}
            <Note color="#ffb300">
              ⚡  WiFi vs Ethernet: Our benchmarks show WiFi adds ~30–60ms of decode jitter vs ~1–5ms
              on Ethernet. On a 20fps camera over WiFi, the GPU spends 90% of its time waiting for
              packets. Ethernet (PoE) is the single biggest performance upgrade you can make.
            </Note>
            <Note color="#00d4ff">
              ℹ  Check your camera's web interface (usually at <Code>http://CAMERA_IP</Code>) to verify
              and adjust the frame rate. Many cameras default to 15–20fps but can be increased to 25fps
              in their settings.
            </Note>
          </SectionPanel>
        </Box>

        {/* ═══ TIPS ═══ */}
        <Box id="guide-tips" sx={{ mt: 1 }}>
          <SectionPanel title="Tips & Troubleshooting">
            {[
              {
                q: "Training progress is stuck at 0%",
                a: "The progress bar reads epoch lines from the training log. Make sure training has actually started — check the PROCESS OUTPUT terminal for errors. If no log lines appear, the backend may not be running.",
                color: "#ff6b35",
              },
              {
                q: "Out of memory (CUDA OOM) during training",
                a: "Reduce Batch Size from 64 to 16 or 8. Also try reducing Image Size from 960 to 640. These changes significantly lower VRAM usage.",
                color: "#ffb300",
              },
              {
                q: "Detection is too slow / low FPS",
                a: "Switch to a lighter model like yolo26n.pt. Ensure detection is running from the Detection tab, not a custom script. Check GPU utilisation in the Troubleshooting tab benchmark.",
                color: "#ffb300",
              },
              {
                q: "Many false detections (birds or objects detected as drones)",
                a: "Increase the Confidence Threshold to 0.4–0.6. This filters out lower-confidence detections. You can also retrain with more diverse negative examples in your dataset.",
                color: "#00d4ff",
              },
              {
                q: "Backend not responding / API errors",
                a: "Make sure the backend is running: activate the venv and run uvicorn app.main:app --reload --port 8000 from the backend folder. The frontend at port 3000 requires port 8000 to be reachable.",
                color: "#00d4ff",
              },
              {
                q: "Login fails even with correct credentials",
                a: "Usernames are case-insensitive but passwords are case-sensitive. Check Caps Lock. If the account was created before the system migration, it may have been normalised to lowercase — try the lowercase version of the username.",
                color: "#00d4ff",
              },
              {
                q: "throw_no_cuda / 'functionality is disabled for current build'",
                a: "OpenCV was compiled without NVCUVID support. Re-run cmake in the build directory to re-detect NVCUVID, rebuild the cudacodec module, and copy the required DLLs to your venv. Check the Troubleshooting tab System Check to verify NVCUVID status.",
                color: "#ff6b35",
              },
              {
                q: "YOLO error: input size [1, 4, 640, 640] not equal to model size [1, 3, ...]",
                a: "NVDEC outputs 4-channel BGRA frames instead of 3-channel BGR. DroneSentinel handles this automatically. If you run YOLO directly on NVDEC output in custom code, convert with cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR) first.",
                color: "#ffb300",
              },
              {
                q: "FPS is capped at 20 despite GPU being fast",
                a: "Your camera likely outputs at 20fps — that is the ceiling regardless of GPU speed. Check your camera's web interface and increase the frame rate to 25fps. Use the Troubleshooting tab benchmark to confirm: if decode min time is near 0ms but average is ~50ms, the GPU is waiting for camera frames.",
                color: "#00d4ff",
              },
              {
                q: "GPU decode and CPU decode show the same speed",
                a: "WiFi is the bottleneck, not the decoder. Both GPU and CPU spend most of their time waiting for packets. Switch to Ethernet or reduce WiFi interference to see the true NVDEC advantage.",
                color: "#00d4ff",
              },
              {
                q: "RTSP stream timeout (CUDA_ERROR_FILE_NOT_FOUND)",
                a: "The camera is offline or unreachable. Check that the camera is powered on, on the same network, and that the IP and credentials in the RTSP URL are correct. Use the Troubleshooting tab Ping tool to verify connectivity.",
                color: "#ff6b35",
              },
            ].map(({ q, a, color }) => (
              <Box key={q} sx={{ mb: 2 }}>
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, mb: 0.5 }}>
                  <Box sx={{ color, fontFamily: '"IBM Plex Mono"', fontSize: "0.72rem", mt: "2px", flexShrink: 0 }}>▸</Box>
                  <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.8rem", color: "#e6edf3", fontWeight: 600 }}>{q}</Typography>
                </Box>
                <Typography sx={{ fontFamily: '"IBM Plex Mono"', fontSize: "0.75rem", color: "#7d8590", ml: 3, lineHeight: 1.8 }}>{a}</Typography>
              </Box>
            ))}
          </SectionPanel>
        </Box>

      </Box>{/* end main content */}
    </Box>
  );
}
