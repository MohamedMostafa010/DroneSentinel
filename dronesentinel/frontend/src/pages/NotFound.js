import React, { useEffect, useState } from "react";
import { Box, Typography, Button, Divider } from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";

// Radar crosshair with question mark — "target not found"
function RadarIcon() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer circle */}
      <circle cx="40" cy="40" r="36" stroke="#ffb30040" strokeWidth="1.5" strokeDasharray="4 4" />
      {/* Middle circle */}
      <circle cx="40" cy="40" r="24" stroke="#ffb30060" strokeWidth="1.5" />
      {/* Inner circle */}
      <circle cx="40" cy="40" r="12" stroke="#ffb300" strokeWidth="1.5" />
      {/* Crosshair lines */}
      <line x1="40" y1="4"  x2="40" y2="20" stroke="#ffb300" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="40" y1="60" x2="40" y2="76" stroke="#ffb300" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="4"  y1="40" x2="20" y2="40" stroke="#ffb300" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="60" y1="40" x2="76" y2="40" stroke="#ffb300" strokeWidth="1.5" strokeLinecap="round" />
      {/* Question mark center */}
      <text x="40" y="46" textAnchor="middle" fill="#ffb300" fontSize="16" fontFamily="IBM Plex Mono, monospace" fontWeight="700">?</text>
    </svg>
  );
}

export default function NotFound() {
  const navigate  = useNavigate();
  const location  = useLocation();

  // Rotating radar sweep angle
  const [angle, setAngle] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setAngle(a => (a + 2) % 360), 30);
    return () => clearInterval(id);
  }, []);

  // Scan line
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => (t + 1) % 100), 40);
    return () => clearInterval(id);
  }, []);

  const rad = (angle * Math.PI) / 180;
  const sweepX = 40 + 36 * Math.cos(rad);
  const sweepY = 40 + 36 * Math.sin(rad);

  return (
    <Box sx={{
      minHeight: "calc(100vh - 52px)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      bgcolor: "#080c10",
      position: "relative",
      overflow: "hidden",
    }}>

      {/* Amber radial glow */}
      <Box sx={{
        position: "absolute",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: 600, height: 600,
        borderRadius: "50%",
        background: "radial-gradient(circle, #ffb30010 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Scan line */}
      <Box sx={{
        position: "absolute",
        left: 0, right: 0,
        top: `${tick}%`,
        height: "1px",
        background: "linear-gradient(90deg, transparent 0%, #ffb30018 30%, #ffb30030 50%, #ffb30018 70%, transparent 100%)",
        pointerEvents: "none",
      }} />

      {/* Corner decorations */}
      {[
        { top: 32, left: 32 },
        { top: 32, right: 32 },
        { bottom: 32, left: 32 },
        { bottom: 32, right: 32 },
      ].map((pos, i) => (
        <Box key={i} sx={{
          position: "absolute", ...pos,
          width: 20, height: 20,
          borderTop:    i < 2  ? "1px solid #ffb30030" : "none",
          borderBottom: i >= 2 ? "1px solid #ffb30030" : "none",
          borderLeft:   i % 2 === 0 ? "1px solid #ffb30030" : "none",
          borderRight:  i % 2 === 1 ? "1px solid #ffb30030" : "none",
        }} />
      ))}

      {/* Content card */}
      <Box sx={{
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 2, zIndex: 1, textAlign: "center",
        border: "1px solid #ffb30018",
        bgcolor: "#0b101808",
        backdropFilter: "blur(4px)",
        borderRadius: 2,
        p: 6,
        maxWidth: 520,
      }}>

        {/* Animated radar icon */}
        <Box sx={{
          position: "relative",
          width: 80, height: 80,
          filter: "drop-shadow(0 0 16px #ffb30080) drop-shadow(0 0 32px #ffb30040)",
          mb: 1,
        }}>
          <RadarIcon />
          {/* Rotating sweep line */}
          <svg
            width="80" height="80" viewBox="0 0 80 80"
            style={{ position: "absolute", top: 0, left: 0 }}
          >
            <line
              x1="40" y1="40"
              x2={sweepX} y2={sweepY}
              stroke="#ffb300"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.7"
            />
            <circle cx={sweepX} cy={sweepY} r="2" fill="#ffb300" opacity="0.5" />
          </svg>
        </Box>

        {/* 404 */}
        <Typography sx={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: "5rem",
          fontWeight: 700,
          lineHeight: 1,
          color: "#ffb300",
          textShadow: "0 0 30px #ffb30080, 0 0 60px #ffb30040",
          letterSpacing: "0.05em",
        }}>
          404
        </Typography>

        {/* NOT FOUND */}
        <Typography sx={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: "0.85rem",
          fontWeight: 600,
          color: "#00d4ff",
          letterSpacing: "0.45em",
          textTransform: "uppercase",
          textShadow: "0 0 12px #00d4ff60",
        }}>
          Not Found
        </Typography>

        <Divider sx={{
          width: "100%", borderColor: "#ffb30020",
          "&::before, &::after": { borderColor: "#ffb30020" },
        }}>
          <Typography sx={{
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: "0.62rem", color: "#3a4555",
            letterSpacing: "0.2em", px: 1,
          }}>
            TARGET LOST
          </Typography>
        </Divider>

        {/* Description */}
        <Typography sx={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: "0.78rem",
          color: "#6e7a8a",
          lineHeight: 1.7,
          letterSpacing: "0.02em",
        }}>
          The page you are looking for does not exist
          <br />
          or has been moved to another location.
        </Typography>

        {/* Attempted path */}
        <Box sx={{
          display: "flex", alignItems: "center", gap: 1,
          px: 2, py: 0.75, borderRadius: 1,
          bgcolor: "#ffb30008", border: "1px solid #ffb30020",
        }}>
          <Typography sx={{
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: "0.65rem", color: "#3a4555", letterSpacing: "0.1em",
          }}>
            PATH:
          </Typography>
          <Typography sx={{
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: "0.65rem", color: "#ffb30080",
          }}>
            {location.pathname}
          </Typography>
        </Box>

        {/* Buttons */}
        <Box sx={{ display: "flex", gap: 2, mt: 1 }}>
          <Button
            variant="outlined"
            onClick={() => navigate(-1)}
            sx={{
              borderColor: "#ffb30040",
              color: "#ffb300",
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: "0.72rem",
              letterSpacing: "0.15em",
              px: 3, py: 0.8,
              "&:hover": {
                borderColor: "#ffb300",
                bgcolor: "#ffb3000a",
                boxShadow: "0 0 16px #ffb30020",
              },
            }}
          >
            ← Go Back
          </Button>
          <Button
            variant="outlined"
            onClick={() => navigate("/")}
            sx={{
              borderColor: "#00d4ff40",
              color: "#00d4ff",
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: "0.72rem",
              letterSpacing: "0.15em",
              px: 3, py: 0.8,
              "&:hover": {
                borderColor: "#00d4ff",
                bgcolor: "#00d4ff0a",
                boxShadow: "0 0 16px #00d4ff20",
              },
            }}
          >
            ⌂ Dashboard
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
