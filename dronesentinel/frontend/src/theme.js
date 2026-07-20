import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary:    { main: "#00d4ff" },
    secondary:  { main: "#ff6b35" },
    success:    { main: "#00e676" },
    error:      { main: "#ff3d3d" },
    warning:    { main: "#ffb300" },
    background: { default: "#060a0e", paper: "#0b1018" },
    text:       { primary: "#e6edf3", secondary: "#6e7a8a" },
  },
  typography: {
    fontFamily: '"IBM Plex Mono", "Courier New", monospace',
    h4: { fontFamily: '"IBM Plex Sans", sans-serif', fontWeight: 700, letterSpacing: "-0.5px" },
    h5: { fontFamily: '"IBM Plex Sans", sans-serif', fontWeight: 700, letterSpacing: "-0.3px" },
    h6: { fontFamily: '"IBM Plex Sans", sans-serif', fontWeight: 600 },
    caption: { fontFamily: '"IBM Plex Mono", monospace', letterSpacing: "0.08em" },
  },
  shape: { borderRadius: 2 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: "#060a0e",
          // Subtle dot-grid background
          backgroundImage: `
            radial-gradient(circle at 1px 1px, #1c233320 1px, transparent 0)
          `,
          backgroundSize: "28px 28px",
        },
        "*::-webkit-scrollbar": { width: "4px", height: "4px" },
        "*::-webkit-scrollbar-track": { background: "transparent" },
        "*::-webkit-scrollbar-thumb": { background: "#1c2333", borderRadius: "4px" },
        "*::-webkit-scrollbar-thumb:hover": { background: "#2a3444" },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid #1a2232",
          backdropFilter: "blur(2px)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          fontFamily: '"IBM Plex Mono", monospace',
          fontWeight: 600,
          fontSize: "0.75rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          borderRadius: 2,
          transition: "all 0.2s ease",
          "&:hover": { transform: "translateY(-1px)" },
          "&:active": { transform: "translateY(0)" },
        },
        containedPrimary: {
          boxShadow: "0 0 20px #00d4ff20",
          "&:hover": { boxShadow: "0 0 28px #00d4ff40" },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: "0.85rem",
            transition: "all 0.2s ease",
            "& fieldset": { borderColor: "#1a2232" },
            "&:hover fieldset": { borderColor: "#00d4ff30" },
            "&.Mui-focused fieldset": { borderColor: "#00d4ff", boxShadow: "0 0 0 2px #00d4ff10" },
          },
          "& .MuiInputLabel-root": {
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: "0.8rem",
            letterSpacing: "0.05em",
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: "0.85rem",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontFamily: '"IBM Plex Mono", monospace',
          fontWeight: 500,
          letterSpacing: "0.04em",
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 2,
          backgroundColor: "#1a2232",
        },
        bar: { borderRadius: 2 },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: {
          "&.Mui-checked": { color: "#00d4ff" },
          "&.Mui-checked + .MuiSwitch-track": { backgroundColor: "#00d4ff40" },
        },
        track: { backgroundColor: "#1a2232" },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundImage: "none",
          backgroundColor: "#0b1018",
          border: "1px solid #1a2232",
          boxShadow: "0 24px 64px #000a",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundImage: "none",
          backgroundColor: "#060a0e",
          backgroundImage: `radial-gradient(circle at 1px 1px, #1c233318 1px, transparent 0)`,
          backgroundSize: "28px 28px",
        },
      },
    },
    MuiAppBar: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: "0.72rem",
          backgroundColor: "#0b1018",
          border: "1px solid #1a2232",
          color: "#c9d1d9",
        },
        arrow: { color: "#1a2232" },
      },
    },
  },
});

export default theme;
