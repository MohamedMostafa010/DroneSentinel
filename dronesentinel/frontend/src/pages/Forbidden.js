import React, { useEffect, useState } from "react";
import { Box, Typography, Button, Chip, Divider } from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext";

const ROLE_COLOR = { admin: "#ff6b35", operator: "#00d4ff", technical: "#00e676" };

// Shield with lock SVG
function ShieldLockIcon() {
  return (
    <svg width="72" height="80" viewBox="0 0 72 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M36 2L6 14v22c0 20 13 37 30 42 17-5 30-22 30-42V14L36 2z"
        fill="#ff3d3d0d"
        stroke="#ff3d3d"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Lock body */}
      <rect x="24" y="36" width="24" height="18" rx="2" fill="#ff3d3d" opacity="0.9" />
      {/* Lock shackle */}
      <path
        d="M28 36v-5a8 8 0 0 1 16 0v5"
        stroke="#ff3d3d"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Keyhole */}
      <circle cx="36" cy="44" r="2.5" fill="#080c10" />
      <rect x="35" y="45.5" width="2" height="4" rx="1" fill="#080c10" />
    </svg>
  );
}

export default function Forbidden() {
  const navigate = useNavigate();
  const location  = useLocation();
  const { auth }  = useAuth();

  const roleColor = auth ? (ROLE_COLOR[auth.role] ?? "#6e7a8a") : "#6e7a8a";

  // Animated scan line counter
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => (t + 1) % 100), 40);
    return () => clearInterval(id);
  }, []);

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

      {/* Subtle red radial glow */}
      <Box sx={{
        position: "absolute",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: 600, height: 600,
        borderRadius: "50%",
        background: "radial-gradient(circle, #ff3d3d10 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Horizontal scan line */}
      <Box sx={{
        position: "absolute",
        left: 0, right: 0,
        top: `${tick}%`,
        height: "1px",
        background: "linear-gradient(90deg, transparent 0%, #ff3d3d18 30%, #ff3d3d30 50%, #ff3d3d18 70%, transparent 100%)",
        pointerEvents: "none",
        transition: "top 0.04s linear",
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
          borderTop: i < 2 ? "1px solid #ff3d3d30" : "none",
          borderBottom: i >= 2 ? "1px solid #ff3d3d30" : "none",
          borderLeft: i % 2 === 0 ? "1px solid #ff3d3d30" : "none",
          borderRight: i % 2 === 1 ? "1px solid #ff3d3d30" : "none",
        }} />
      ))}

      {/* Content */}
      <Box sx={{
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 2, zIndex: 1, px: 4, textAlign: "center",
        border: "1px solid #ff3d3d18",
        bgcolor: "#0b101808",
        backdropFilter: "blur(4px)",
        borderRadius: 2,
        p: 6,
        maxWidth: 520,
      }}>

        {/* Shield icon with glow */}
        <Box sx={{
          filter: "drop-shadow(0 0 16px #ff3d3d80) drop-shadow(0 0 32px #ff3d3d40)",
          mb: 1,
        }}>
          <ShieldLockIcon />
        </Box>

        {/* 403 */}
        <Typography sx={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: "5rem",
          fontWeight: 700,
          lineHeight: 1,
          color: "#ff3d3d",
          textShadow: "0 0 30px #ff3d3d80, 0 0 60px #ff3d3d40",
          letterSpacing: "0.05em",
        }}>
          403
        </Typography>

        {/* ACCESS DENIED */}
        <Typography sx={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: "0.85rem",
          fontWeight: 600,
          color: "#00d4ff",
          letterSpacing: "0.45em",
          textTransform: "uppercase",
          textShadow: "0 0 12px #00d4ff60",
        }}>
          Access Denied
        </Typography>

        <Divider sx={{
          width: "100%", borderColor: "#ff3d3d20",
          "&::before, &::after": { borderColor: "#ff3d3d20" },
        }}>
          <Typography sx={{
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: "0.62rem", color: "#3a4555",
            letterSpacing: "0.2em", px: 1,
          }}>
            FORBIDDEN
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
          You do not have permission to access this resource.
          <br />
          Contact your administrator if you believe this is a mistake.
        </Typography>

        {/* Attempted path */}
        {location.state?.from && (
          <Box sx={{
            display: "flex", alignItems: "center", gap: 1,
            px: 2, py: 0.75, borderRadius: 1,
            bgcolor: "#ff3d3d08", border: "1px solid #ff3d3d20",
          }}>
            <Typography sx={{
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: "0.65rem", color: "#3a4555", letterSpacing: "0.1em",
            }}>
              ATTEMPTED:
            </Typography>
            <Typography sx={{
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: "0.65rem", color: "#ff3d3d80",
            }}>
              {location.state.from}
            </Typography>
          </Box>
        )}

        {/* Authenticated as */}
        {auth && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", justifyContent: "center" }}>
            <Typography sx={{
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: "0.65rem", color: "#3a4555", letterSpacing: "0.1em",
            }}>
              AUTHENTICATED AS
            </Typography>
            <Chip
              label={auth.username}
              size="small"
              sx={{
                height: 18, fontSize: "0.62rem",
                bgcolor: "#ffffff08", color: "#c9d1d9",
                border: "1px solid #1a2232",
                fontFamily: '"IBM Plex Mono", monospace',
              }}
            />
            <Chip
              label={auth.role.toUpperCase()}
              size="small"
              sx={{
                height: 18, fontSize: "0.62rem",
                bgcolor: `${roleColor}12`,
                color: roleColor,
                border: `1px solid ${roleColor}35`,
                fontFamily: '"IBM Plex Mono", monospace',
              }}
            />
          </Box>
        )}

        {/* Back button */}
        <Button
          variant="outlined"
          onClick={() => navigate(-1)}
          sx={{
            mt: 1,
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
          ← Go Back
        </Button>
      </Box>
    </Box>
  );
}
