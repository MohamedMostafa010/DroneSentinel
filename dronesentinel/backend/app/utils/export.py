import json
from datetime import datetime

import pandas as pd
from reportlab.lib.pagesizes import letter
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle,
    Paragraph, Spacer, HRFlowable,
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch


# ── Shared colour palette (matches DroneSentinel UI) ─────────────────────────
_BG0   = colors.HexColor("#0b1018")
_BG1   = colors.HexColor("#0d1520")
_BG2   = colors.HexColor("#1a2232")
_BLUE  = colors.HexColor("#00d4ff")
_GREEN = colors.HexColor("#00e676")
_AMBER = colors.HexColor("#ffb300")
_RED   = colors.HexColor("#ff6b35")
_TEXT  = colors.HexColor("#e6edf3")
_MUTED = colors.HexColor("#6e7a8a")
_GRID  = colors.HexColor("#2a3444")

_TABLE_STYLE = [
    ("BACKGROUND",     (0, 0), (-1,  0), _BG2),
    ("TEXTCOLOR",      (0, 0), (-1,  0), _BLUE),
    ("FONTNAME",       (0, 0), (-1,  0), "Helvetica-Bold"),
    ("FONTSIZE",       (0, 0), (-1, -1), 9),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [_BG1, _BG0]),
    ("TEXTCOLOR",      (0, 1), (-1, -1), _TEXT),
    ("GRID",           (0, 0), (-1, -1), 0.4, _GRID),
    ("PADDING",        (0, 0), (-1, -1), 7),
    ("VALIGN",         (0, 0), (-1, -1), "MIDDLE"),
]


class DataExportManager:
    """
    Produces CSV / JSON / PDF exports from the analytics_service.get_current() dict.
    All three formats contain the same information as the HTML session report:
      • Session metadata  — start time, duration, source, model, total frames, avg FPS
      • Summary counters  — total drones, alerts sent, session avg confidence
      • Per-drone detail  — detections, first/last frame, min/avg/max confidence
    """

    # ── CSV ───────────────────────────────────────────────────────────────────
    @staticmethod
    def to_csv(data: dict, filename: str) -> str:
        drones  = data.get("detected_drones", {})
        session = {
            "session_start":    data.get("session_start",    ""),
            "duration":         data.get("duration",         ""),
            "source":           data.get("source",           ""),
            "model":            data.get("model",            ""),
            "total_frames":     data.get("total_frames",     0),
            "avg_fps":          round(float(data.get("fps", 0)), 1),
            "total_drones":     data.get("total_drones",     0),
            "alerts_sent":      data.get("alerts_sent",      0),
            "session_avg_conf": round(float(data.get("avg_confidence", 0)), 3),
        }
        rows = []
        if drones:
            for drone_id, d in drones.items():
                rows.append({
                    **session,
                    "drone_id":            drone_id,
                    "total_detections":    d.get("detection_count", 0),
                    "first_detected_frame": d.get("first_detected", ""),
                    "last_detected_frame":  d.get("last_detected",  ""),
                    "min_confidence":      f"{d.get('min_confidence', 0):.3f}",
                    "avg_confidence":      f"{d.get('avg_confidence', 0):.3f}",
                    "max_confidence":      f"{d.get('max_confidence', 0):.3f}",
                })
        else:
            rows.append({**session,
                         "drone_id": "", "total_detections": 0,
                         "first_detected_frame": "", "last_detected_frame": "",
                         "min_confidence": "", "avg_confidence": "", "max_confidence": ""})

        pd.DataFrame(rows).to_csv(filename, index=False)
        return filename

    # ── JSON ──────────────────────────────────────────────────────────────────
    @staticmethod
    def to_json(data: dict, filename: str) -> str:
        drones = data.get("detected_drones", {})
        export = {
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "session": {
                "start":               data.get("session_start",    ""),
                "duration":            data.get("duration",         ""),
                "duration_seconds":    data.get("duration_seconds", 0),
                "source":              data.get("source",           ""),
                "model":               data.get("model",            ""),
                "total_frames":        data.get("total_frames",     0),
                "avg_fps":             round(float(data.get("fps", 0)), 1),
                "total_drones":        data.get("total_drones",     0),
                "alerts_sent":         data.get("alerts_sent",      0),
                "avg_confidence":      round(float(data.get("avg_confidence", 0)), 3),
            },
            "drones": {
                drone_id: {
                    "total_detections":     d.get("detection_count", 0),
                    "first_detected_frame": d.get("first_detected",  ""),
                    "last_detected_frame":  d.get("last_detected",   ""),
                    "min_confidence":       round(float(d.get("min_confidence", 0)), 3),
                    "avg_confidence":       round(float(d.get("avg_confidence", 0)), 3),
                    "max_confidence":       round(float(d.get("max_confidence", 0)), 3),
                }
                for drone_id, d in drones.items()
            },
        }
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(export, f, indent=2, default=str)
        return filename

    # ── PDF ───────────────────────────────────────────────────────────────────
    @staticmethod
    def to_pdf(data: dict, filename: str) -> str:
        doc = SimpleDocTemplate(
            filename, pagesize=letter,
            leftMargin=0.75*inch, rightMargin=0.75*inch,
            topMargin=0.75*inch,  bottomMargin=0.75*inch,
        )

        label_style = ParagraphStyle(
            "Label", fontName="Helvetica-Bold", fontSize=8,
            textColor=_MUTED, spaceBefore=12, spaceAfter=5,
        )
        title_style = ParagraphStyle(
            "Title", fontName="Helvetica-Bold", fontSize=18,
            textColor=_BLUE,  spaceAfter=4,
        )
        sub_style = ParagraphStyle(
            "Sub", fontName="Helvetica", fontSize=9,
            textColor=_MUTED, spaceAfter=16,
        )
        drone_hdr_style = ParagraphStyle(
            "DroneHdr", fontName="Helvetica-Bold", fontSize=11,
            textColor=_AMBER, spaceBefore=18, spaceAfter=6,
        )

        drones = data.get("detected_drones", {})
        story  = []

        # ── Header ────────────────────────────────────────────────────────────
        story.append(Paragraph("◈ DroneSentinel", title_style))
        story.append(Paragraph("Detection Session Report", sub_style))
        story.append(HRFlowable(width="100%", thickness=1, color=_BG2, spaceAfter=12))

        # ── Session overview ──────────────────────────────────────────────────
        story.append(Paragraph("SESSION OVERVIEW", label_style))
        overview_data = [
            ["Field",         "Value"],
            ["Date",          data.get("session_start",   "—")],
            ["Duration",      data.get("duration",        "—")],
            ["Total Frames",  f"{data.get('total_frames', 0):,}"],
            ["Average FPS",   f"{float(data.get('fps', 0)):.1f}"],
            ["Source",        data.get("source",          "—")],
            ["Model",         data.get("model",           "—")],
            ["Total Drones",  str(data.get("total_drones", 0))],
            ["Alerts Sent",   str(data.get("alerts_sent",  0))],
            ["Session Avg Confidence", f"{float(data.get('avg_confidence', 0)):.3f}"],
        ]
        ov_style = _TABLE_STYLE + [
            ("TEXTCOLOR", (0, 0), (-1, 0), _BLUE),
            ("TEXTCOLOR", (0, 7), (1, 7), _RED),    # Alerts Sent row highlight
        ]
        ov = Table(overview_data, colWidths=[2.2*inch, 4.3*inch])
        ov.setStyle(TableStyle(ov_style))
        story.append(ov)

        # ── Per-drone section ─────────────────────────────────────────────────
        if drones:
            for drone_id, d in sorted(drones.items()):
                story.append(Spacer(1, 10))
                story.append(Paragraph(f"DRONE #{drone_id}", drone_hdr_style))
                story.append(HRFlowable(width="100%", thickness=0.5, color=_AMBER, spaceAfter=8))

                min_c = float(d.get("min_confidence", 0))
                avg_c = float(d.get("avg_confidence", 0))
                max_c = float(d.get("max_confidence", 0))

                drone_data = [
                    ["Metric",                "Value"],
                    ["Total Detections",      f"{d.get('detection_count', 0):,}"],
                    ["First Detected (frame)", f"{d.get('first_detected', '—'):,}" if d.get('first_detected') else "—"],
                    ["Last Detected (frame)",  f"{d.get('last_detected',  '—'):,}" if d.get('last_detected')  else "—"],
                    ["Min Confidence",        f"{min_c:.3f}"],
                    ["Avg Confidence",        f"{avg_c:.3f}"],
                    ["Max Confidence",        f"{max_c:.3f}"],
                ]
                dr_style = _TABLE_STYLE + [
                    ("TEXTCOLOR", (0, 0), (-1, 0), _AMBER),
                    ("TEXTCOLOR", (1, 4), (1, 4),  _MUTED),   # min — muted
                    ("TEXTCOLOR", (1, 5), (1, 5),  _AMBER),   # avg — amber
                    ("TEXTCOLOR", (1, 6), (1, 6),  _GREEN),   # max — green
                    ("FONTNAME",  (1, 5), (1, 6),  "Helvetica-Bold"),
                ]
                dr = Table(drone_data, colWidths=[2.2*inch, 4.3*inch])
                dr.setStyle(TableStyle(dr_style))
                story.append(dr)

        # ── Footer ────────────────────────────────────────────────────────────
        story.append(Spacer(1, 20))
        story.append(HRFlowable(width="100%", thickness=0.5, color=_BG2))
        story.append(Paragraph(
            f"Generated by DroneSentinel · AI Drone Detection System · "
            f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            ParagraphStyle("Footer", fontName="Helvetica", fontSize=7,
                           textColor=_MUTED, spaceBefore=6),
        ))

        doc.build(story)
        return filename

    # ── HTML ──────────────────────────────────────────────────────────────────
    @staticmethod
    def to_html(data: dict, filename: str) -> str:
        drones       = data.get("detected_drones", {})
        session_time = data.get("session_start", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        duration     = data.get("duration", "—")
        source       = data.get("source", "—")
        model        = data.get("model", "—")
        total_frames = data.get("total_frames", 0)
        avg_fps      = float(data.get("fps", 0))
        total_drones = data.get("total_drones", 0)
        alerts_sent  = data.get("alerts_sent", 0)

        drone_html = ""
        for drone_id, d in sorted(drones.items()):
            det_count = d.get("detection_count", 0)
            min_conf  = float(d.get("min_confidence", 0))
            avg_conf  = float(d.get("avg_confidence", 0))
            max_conf  = float(d.get("max_confidence", 0))
            first_fr  = d.get("first_detected", 0)
            last_fr   = d.get("last_detected",  0)
            bar_pct   = round(avg_conf  * 100, 1)
            bar_min   = round(min_conf  * 100, 1)
            range_start = round((min_conf / max_conf) * 100, 1) if max_conf else 0

            drone_html += f"""
  <div style="padding:0 40px 32px 40px;">
    <h2 style="margin:0 0 16px 0;font-size:11px;letter-spacing:0.25em;
               text-transform:uppercase;color:#6e7a8a;
               border-bottom:1px solid #1a2232;padding-bottom:10px;">
      DRONE #{drone_id} &mdash; DETECTION SUMMARY
    </h2>
    <div style="display:flex;gap:16px;margin-bottom:24px;">
      <div style="flex:1;background:#0d1520;border:1px solid #1a2232;
                  border-top:2px solid #00d4ff;padding:16px 20px;">
        <p style="margin:0 0 6px 0;font-size:10px;letter-spacing:0.2em;
                  text-transform:uppercase;color:#6e7a8a;">TOTAL DETECTIONS</p>
        <p style="margin:0;font-size:28px;font-weight:700;color:#00d4ff;">{det_count:,}</p>
      </div>
      <div style="flex:1;background:#0d1520;border:1px solid #1a2232;
                  border-top:2px solid #ffb300;padding:16px 20px;">
        <p style="margin:0 0 6px 0;font-size:10px;letter-spacing:0.2em;
                  text-transform:uppercase;color:#6e7a8a;">AVG CONFIDENCE</p>
        <p style="margin:0;font-size:28px;font-weight:700;color:#ffb300;">{avg_conf:.3f}</p>
      </div>
      <div style="flex:1;background:#0d1520;border:1px solid #1a2232;
                  border-top:2px solid #00e676;padding:16px 20px;">
        <p style="margin:0 0 6px 0;font-size:10px;letter-spacing:0.2em;
                  text-transform:uppercase;color:#6e7a8a;">PEAK CONFIDENCE</p>
        <p style="margin:0;font-size:28px;font-weight:700;color:#00e676;">{max_conf:.3f}</p>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr style="background:#0d1520;">
        <td style="padding:10px 14px;font-size:11px;color:#6e7a8a;
                   letter-spacing:0.12em;text-transform:uppercase;width:200px;">FIRST DETECTED</td>
        <td style="padding:10px 14px;font-size:13px;color:#e6edf3;">Frame {first_fr:,}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-size:11px;color:#6e7a8a;
                   letter-spacing:0.12em;text-transform:uppercase;">LAST DETECTED</td>
        <td style="padding:10px 14px;font-size:13px;color:#e6edf3;">Frame {last_fr:,}</td>
      </tr>
      <tr style="background:#0d1520;">
        <td style="padding:10px 14px;font-size:11px;color:#6e7a8a;
                   letter-spacing:0.12em;text-transform:uppercase;">MIN CONFIDENCE</td>
        <td style="padding:10px 14px;font-size:13px;color:#e6edf3;">{min_conf:.3f}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-size:11px;color:#6e7a8a;
                   letter-spacing:0.12em;text-transform:uppercase;">AVG CONFIDENCE</td>
        <td style="padding:10px 14px;font-size:13px;color:#ffb300;font-weight:600;">{avg_conf:.3f}</td>
      </tr>
      <tr style="background:#0d1520;">
        <td style="padding:10px 14px;font-size:11px;color:#6e7a8a;
                   letter-spacing:0.12em;text-transform:uppercase;">MAX CONFIDENCE</td>
        <td style="padding:10px 14px;font-size:13px;color:#00e676;font-weight:600;">{max_conf:.3f}</td>
      </tr>
    </table>
    <p style="margin:0 0 8px 0;font-size:10px;letter-spacing:0.15em;
              text-transform:uppercase;color:#6e7a8a;">CONFIDENCE RANGE</p>
    <div style="background:#1a2232;height:8px;border-radius:4px;position:relative;margin-bottom:6px;">
      <div style="background:linear-gradient(90deg,#ffb300,#00e676);height:8px;border-radius:4px;
                  margin-left:{range_start}%;width:{bar_pct - bar_min}%;"></div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:4px;">
      <span style="font-size:10px;color:#6e7a8a;">{min_conf:.3f} (min)</span>
      <span style="font-size:10px;color:#ffb300;">{avg_conf:.3f} (avg)</span>
      <span style="font-size:10px;color:#6e7a8a;">{max_conf:.3f} (max)</span>
    </div>
  </div>
"""

        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>DroneSentinel Report &mdash; {session_time}</title>
</head>
<body style="margin:0;padding:0;background:#0b1018;color:#e6edf3;
             font-family:'Segoe UI',Arial,sans-serif;">
  <div style="background:linear-gradient(135deg,#0d1520 0%,#0b1018 100%);
              border-bottom:2px solid #00d4ff30;padding:32px 40px;">
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:6px;">
      <span style="font-size:26px;color:#00d4ff;">&#9672;</span>
      <span style="font-size:20px;font-weight:700;letter-spacing:0.18em;
                   color:#e6edf3;text-transform:uppercase;">DroneSentinel</span>
    </div>
    <p style="margin:0;font-size:11px;color:#6e7a8a;letter-spacing:0.25em;
              text-transform:uppercase;">Detection Session Report</p>
    <p style="margin:10px 0 0 0;font-size:12px;color:#4a5568;">{session_time}</p>
  </div>
  <div style="padding:32px 40px;">
    <h2 style="margin:0 0 16px 0;font-size:11px;letter-spacing:0.25em;
               text-transform:uppercase;color:#6e7a8a;
               border-bottom:1px solid #1a2232;padding-bottom:10px;">SESSION OVERVIEW</h2>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:9px 0;font-size:11px;color:#6e7a8a;letter-spacing:0.12em;text-transform:uppercase;width:200px;">DATE</td>
          <td style="padding:9px 0;font-size:13px;color:#e6edf3;">{session_time}</td></tr>
      <tr><td style="padding:9px 0;font-size:11px;color:#6e7a8a;letter-spacing:0.12em;text-transform:uppercase;">DURATION</td>
          <td style="padding:9px 0;font-size:13px;color:#e6edf3;">{duration}</td></tr>
      <tr><td style="padding:9px 0;font-size:11px;color:#6e7a8a;letter-spacing:0.12em;text-transform:uppercase;">TOTAL FRAMES</td>
          <td style="padding:9px 0;font-size:13px;color:#e6edf3;">{total_frames:,}</td></tr>
      <tr><td style="padding:9px 0;font-size:11px;color:#6e7a8a;letter-spacing:0.12em;text-transform:uppercase;">AVERAGE FPS</td>
          <td style="padding:9px 0;font-size:13px;color:#00d4ff;">{avg_fps:.1f}</td></tr>
      <tr><td style="padding:9px 0;font-size:11px;color:#6e7a8a;letter-spacing:0.12em;text-transform:uppercase;">SOURCE</td>
          <td style="padding:9px 0;font-size:13px;color:#e6edf3;">{source}</td></tr>
      <tr><td style="padding:9px 0;font-size:11px;color:#6e7a8a;letter-spacing:0.12em;text-transform:uppercase;">MODEL</td>
          <td style="padding:9px 0;font-size:13px;color:#e6edf3;">{model}</td></tr>
      <tr><td style="padding:9px 0;font-size:11px;color:#6e7a8a;letter-spacing:0.12em;text-transform:uppercase;">TOTAL DRONES</td>
          <td style="padding:9px 0;font-size:13px;color:#e6edf3;">{total_drones}</td></tr>
      <tr><td style="padding:9px 0;font-size:11px;color:#6e7a8a;letter-spacing:0.12em;text-transform:uppercase;">ALERTS SENT</td>
          <td style="padding:9px 0;font-size:14px;color:#ff6b35;font-weight:700;">{alerts_sent}</td></tr>
    </table>
  </div>
  {drone_html}
  <div style="border-top:1px solid #1a2232;padding:20px 40px;text-align:center;background:#0d1520;">
    <p style="margin:0;font-size:11px;color:#4a5568;letter-spacing:0.08em;">
      Generated by <strong style="color:#00d4ff;">DroneSentinel</strong>
      &mdash; AI Drone Detection System &mdash; {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
    </p>
  </div>
</body>
</html>"""

        with open(filename, "w", encoding="utf-8") as f:
            f.write(html)
        return filename
