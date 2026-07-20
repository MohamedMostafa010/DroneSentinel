/* Shared UI primitives reused across all pages */
import React from "react";
import { Box, Typography, Paper } from "@mui/material";

/** Page header with glowing accent bar */
export function PageHeader({ icon, title, subtitle }) {
  return (
    <Box sx={{
      mb: 3, pb: 2.5,
      borderBottom: "1px solid #1a2232",
      position: "relative",
    }}>
      {/* Top accent line with gradient */}
      <Box sx={{
        position: "absolute",
        top: -1, left: 0,
        width: 80, height: 2,
        background: "linear-gradient(90deg, #00d4ff 0%, transparent 100%)",
        boxShadow: "0 0 12px #00d4ff80",
      }} />

      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 0.75, pt: 1 }}>
        {/* Icon badge */}
        <Box sx={{
          width: 36, height: 36,
          borderRadius: 1,
          bgcolor: "#00d4ff0e",
          border: "1px solid #00d4ff25",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1rem", color: "#00d4ff",
          boxShadow: "0 0 16px #00d4ff18",
          flexShrink: 0,
        }}>
          {icon}
        </Box>

        <Box>
          <Typography variant="h5" sx={{
            color: "#e6edf3", fontWeight: 700, lineHeight: 1.2,
            letterSpacing: "-0.3px",
          }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography sx={{
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: "0.68rem",
              color: "#6e7a8a",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              mt: 0.3,
            }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}

/** Stat card with gradient glow */
export function StatCard({ label, value, accent = "#00d4ff", unit = "" }) {
  return (
    <Paper sx={{
      p: 2.5,
      bgcolor: "#0b1018",
      borderTop: `2px solid ${accent}`,
      position: "relative",
      overflow: "hidden",
      transition: "transform 0.2s ease, box-shadow 0.2s ease",
      "&:hover": {
        transform: "translateY(-2px)",
        boxShadow: `0 8px 32px ${accent}18`,
      },
      // Radial gradient glow from top
      "&::before": {
        content: '""',
        position: "absolute",
        top: 0, left: 0, right: 0, bottom: 0,
        background: `radial-gradient(ellipse at 30% 0%, ${accent}0e 0%, transparent 65%)`,
        pointerEvents: "none",
      },
      // Subtle corner accent
      "&::after": {
        content: '""',
        position: "absolute",
        top: 0, right: 0,
        width: 40, height: 40,
        background: `linear-gradient(225deg, ${accent}10 0%, transparent 60%)`,
        pointerEvents: "none",
      },
    }}>
      <Typography sx={{
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: "0.62rem",
        color: "#6e7a8a",
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        mb: 1.5,
      }}>
        {label}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5 }}>
        <Typography sx={{
          fontFamily: '"IBM Plex Sans", sans-serif',
          fontSize: "2.2rem",
          fontWeight: 700,
          color: accent,
          lineHeight: 1,
          textShadow: `0 0 20px ${accent}60`,
        }}>
          {value}
        </Typography>
        {unit && (
          <Typography sx={{
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: "0.72rem",
            color: "#6e7a8a",
          }}>
            {unit}
          </Typography>
        )}
      </Box>

      {/* Bottom scan line decoration */}
      <Box sx={{
        position: "absolute",
        bottom: 0, left: 0, right: 0,
        height: 1,
        background: `linear-gradient(90deg, transparent, ${accent}30, transparent)`,
      }} />
    </Paper>
  );
}

/** Terminal-style log panel */
export function LogPanel({ lines = [], height = 240, forwardRef }) {
  const getLineColor = (line) => {
    if (!line) return "#4ec9b0";
    const l = line.toLowerCase();
    if (l.includes("error") || l.includes("fail") || l.includes("exception")) return "#ff6b6b";
    if (l.includes("warn") || l.includes("alert")) return "#ffb300";
    if (l.includes("drone #") || l.includes("detected")) return "#00e676";
    if (l.includes("fps") || l.includes("active")) return "#00d4ff";
    if (l.includes("start") || l.includes("ready") || l.includes("success")) return "#a8ff78";
    return "#4ec9b0";
  };

  return (
    <Paper sx={{
      bgcolor: "#020508",
      border: "1px solid #1a2232",
      overflow: "hidden",
      boxShadow: "inset 0 2px 8px #00000060",
    }}>
      {/* Terminal title bar */}
      <Box sx={{
        display: "flex", alignItems: "center", gap: 1,
        px: 2, py: 1,
        borderBottom: "1px solid #1a2232",
        bgcolor: "#0b1018",
        background: "linear-gradient(90deg, #0b1018 0%, #0d1520 100%)",
      }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c, i) => (
          <Box key={i} sx={{
            width: 9, height: 9, borderRadius: "50%", bgcolor: c,
            boxShadow: `0 0 4px ${c}80`,
          }} />
        ))}
        <Box sx={{
          ml: 1.5,
          display: "flex", alignItems: "center", gap: 1,
        }}>
          <Box sx={{
            width: 6, height: 6, borderRadius: "50%", bgcolor: "#00e676",
            boxShadow: "0 0 6px #00e67680",
            animation: "termPulse 2s infinite ease-in-out",
            "@keyframes termPulse": {
              "0%,100%": { opacity: 1, boxShadow: "0 0 6px #00e67680" },
              "50%": { opacity: 0.4, boxShadow: "0 0 2px #00e67640" },
            },
          }} />
          <Typography sx={{
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: "0.65rem", color: "#6e7a8a",
            letterSpacing: "0.12em",
          }}>
            PROCESS OUTPUT
          </Typography>
        </Box>
        {lines.length > 0 && (
          <Typography sx={{
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: "0.6rem", color: "#00d4ff60",
            letterSpacing: "0.05em",
            ml: "auto",
          }}>
            {lines.length} lines
          </Typography>
        )}
      </Box>

      <Box
        ref={forwardRef}
        sx={{
          p: 2,
          height,
          overflowY: "auto",
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: "0.75rem",
          lineHeight: 1.8,
          // CRT scan lines overlay
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, #ffffff03 2px, #ffffff03 4px)",
        }}
      >
        {lines.length === 0
          ? (
            <Box sx={{
              color: "#6e7a8a",
              display: "flex", alignItems: "center", gap: 1,
            }}>
              <Box sx={{
                width: 8, height: 8, borderRadius: "50%", bgcolor: "#6e7a8a",
                animation: "blink 1s step-end infinite",
                "@keyframes blink": { "0%,100%": { opacity: 1 }, "50%": { opacity: 0 } },
              }} />
              awaiting process...
            </Box>
          )
          : lines.map((l, i) => (
            <Box key={i} sx={{
              display: "flex", gap: 2,
              "&:hover": { bgcolor: "#ffffff06" },
              transition: "background 0.1s",
            }}>
              <Box sx={{ color: "#2a3444", userSelect: "none", minWidth: 28, textAlign: "right", flexShrink: 0 }}>
                {String(i + 1).padStart(3, "0")}
              </Box>
              <Box sx={{ flex: 1, wordBreak: "break-all", color: getLineColor(l) }}>{l}</Box>
            </Box>
          ))
        }
      </Box>
    </Paper>
  );
}

/** Section panel wrapper with gradient header */
export function SectionPanel({ title, children, sx = {}, accentColor }) {
  return (
    <Paper sx={{
      bgcolor: "#0b1018",
      overflow: "hidden",
      mb: 2,
      transition: "box-shadow 0.2s ease",
      "&:hover": { boxShadow: "0 4px 24px #00000040" },
      ...sx,
    }}>
      {title && (
        <Box sx={{
          px: 2.5, py: 1.25,
          borderBottom: "1px solid #1a2232",
          background: "linear-gradient(90deg, #0d1520 0%, #0b1018 100%)",
          display: "flex", alignItems: "center", gap: 1.5,
        }}>
          {accentColor && (
            <Box sx={{
              width: 3, height: 14, borderRadius: 1,
              bgcolor: accentColor,
              boxShadow: `0 0 8px ${accentColor}80`,
              flexShrink: 0,
            }} />
          )}
          <Typography sx={{
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: "0.68rem",
            color: "#6e7a8a",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}>
            {title}
          </Typography>
        </Box>
      )}
      <Box sx={{ p: 2.5 }}>{children}</Box>
    </Paper>
  );
}

/** Status badge dot */
export function StatusDot({ active, size = 8 }) {
  return (
    <Box sx={{
      width: size, height: size, borderRadius: "50%",
      bgcolor: active ? "#00e676" : "#2a3444",
      boxShadow: active ? "0 0 8px #00e676, 0 0 16px #00e67640" : "none",
      transition: "all 0.4s ease",
      animation: active ? "statusPulse 2s infinite ease-in-out" : "none",
      "@keyframes statusPulse": {
        "0%,100%": { boxShadow: "0 0 8px #00e676, 0 0 16px #00e67640" },
        "50%": { boxShadow: "0 0 4px #00e676, 0 0 8px #00e67620" },
      },
    }} />
  );
}

/** Alert callout */
export function AlertBanner({ type = "warning", children }) {
  const colors = {
    warning: "#ffb300",
    error: "#ff3d3d",
    success: "#00e676",
    info: "#00d4ff",
  };
  const c = colors[type] || colors.info;
  return (
    <Box sx={{
      display: "flex", gap: 1.5,
      px: 2, py: 1.25,
      bgcolor: `${c}0a`,
      border: `1px solid ${c}25`,
      borderLeft: `3px solid ${c}`,
      mb: 1.5,
    }}>
      <Typography sx={{
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: "0.75rem",
        color: `${c}cc`,
        lineHeight: 1.6,
      }}>
        {children}
      </Typography>
    </Box>
  );
}
