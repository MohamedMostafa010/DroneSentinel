import numpy as np
from collections import deque


class _KF:
    """
    Constant-velocity Kalman filter for 2-D centroid tracking.
    State: [cx, cy, vx, vy]   Observation: [cx, cy]
    """
    # Class-level matrices — read-only, shared across instances
    _F = np.array([[1,0,1,0],[0,1,0,1],[0,0,1,0],[0,0,0,1]], dtype=float)
    _H = np.array([[1,0,0,0],[0,1,0,0]], dtype=float)
    _Q = np.diag([1., 1., 10., 10.])   # process noise (position / velocity)
    _R = np.diag([25., 25.])            # measurement noise

    def __init__(self, cx: float, cy: float):
        self.x = np.array([cx, cy, 0., 0.])
        self.P = np.eye(4) * 500.

    def predict(self) -> tuple:
        self.x = self._F @ self.x
        self.P = self._F @ self.P @ self._F.T + self._Q
        return float(self.x[0]), float(self.x[1])

    def update(self, cx: float, cy: float) -> tuple:
        z  = np.array([cx, cy])
        y  = z - self._H @ self.x
        S  = self._H @ self.P @ self._H.T + self._R
        K  = self.P @ self._H.T @ np.linalg.inv(S)
        self.x = self.x + K @ y
        self.P = (np.eye(4) - K @ self._H) @ self.P
        return float(self.x[0]), float(self.x[1])


def _assign(cost: np.ndarray):
    """
    Optimal assignment via scipy if available; greedy fallback otherwise.
    For typical tracking scenarios (< 20 tracks) both give identical results.
    """
    try:
        from scipy.optimize import linear_sum_assignment
        return linear_sum_assignment(cost)
    except ImportError:
        n_r, n_c = cost.shape
        used_r: set = set()
        used_c: set = set()
        rows, cols = [], []
        for _, r, c in sorted(
            (cost[r, c], r, c) for r in range(n_r) for c in range(n_c)
        ):
            if r not in used_r and c not in used_c:
                rows.append(r)
                cols.append(c)
                used_r.add(r)
                used_c.add(c)
        return rows, cols


class BotSortTracker:
    """
    Improved centroid tracker with three key enhancements over the basic version:
    1. Per-track Kalman filter predicts where the drone will be before matching —
       handles fast movement between YOLO inference frames without ID switches.
    2. Hungarian (or greedy) assignment finds the globally optimal
       detection↔track pairing instead of a greedy nearest-neighbour search.
    3. Larger lost-frame budget and distance threshold survive brief occlusions
       and faster drone movement.
    """

    def __init__(self, confidence: float = 0.25):
        self.confidence   = confidence
        self.tracks:        dict[int, dict]   = {}
        self.track_history: dict[int, deque]  = {}
        self._next_id     = 1
        self._max_lost    = 120    # ~6 s at 20 FPS before a track is dropped
        self._dist_thresh = 500    # px in 2560×1440 space to accept a match

    def update(self, dets: list, frame) -> list:
        # ── 1. Kalman-predict each track's next centroid ───────────────────────
        for t in self.tracks.values():
            t["px"], t["py"] = t["kf"].predict()
            t["lost"] += 1

        # ── 2. Drop tracks lost for too many frames ────────────────────────────
        for tid in [k for k, v in self.tracks.items() if v["lost"] > self._max_lost]:
            del self.tracks[tid]

        if not dets:
            return []

        # ── 3. Detection centroids as plain Python floats ──────────────────────
        det_cxcy = [
            (float(d[0] + d[2]) / 2.0, float(d[1] + d[3]) / 2.0)
            for d in dets
        ]

        # ── 4. Cost matrix: Euclidean distance (predicted pos → detection) ─────
        matched_det: set[int] = set()
        track_ids = list(self.tracks.keys())

        if track_ids:
            n_d, n_t = len(dets), len(track_ids)
            cost = np.full((n_d, n_t), 1e6)
            for i, (cx, cy) in enumerate(det_cxcy):
                for j, tid in enumerate(track_ids):
                    t = self.tracks[tid]
                    cost[i, j] = ((cx - t["px"])**2 + (cy - t["py"])**2) ** 0.5

            for r, c in zip(*_assign(cost)):
                if cost[r, c] >= self._dist_thresh:
                    continue                        # too far — not the same object
                tid = track_ids[c]
                matched_det.add(r)
                cx, cy = det_cxcy[r]
                det    = dets[r]
                t      = self.tracks[tid]
                t["kf"].update(cx, cy)
                t.update({
                    "x1": det[0], "y1": det[1], "x2": det[2], "y2": det[3],
                    "cx": cx,     "cy": cy,
                    "conf": det[4], "cls_id": det[5], "lost": 0,
                })
                self.track_history[tid].append((cx, cy))

        # ── 5. Unmatched detections → new tracks ──────────────────────────────
        for i, det in enumerate(dets):
            if i in matched_det:
                continue
            cx, cy = det_cxcy[i]
            tid = self._next_id
            self._next_id += 1
            self.tracks[tid] = {
                "x1": det[0], "y1": det[1], "x2": det[2], "y2": det[3],
                "cx": cx, "cy": cy, "conf": det[4], "cls_id": det[5],
                "lost": 0,
                "kf": _KF(cx, cy),
                "px": cx, "py": cy,
            }
            self.track_history[tid] = deque(maxlen=50)
            self.track_history[tid].append((cx, cy))

        # ── 6. Return only currently visible (lost == 0) tracks ───────────────
        return [
            {
                "x1": float(t["x1"]), "y1": float(t["y1"]),
                "x2": float(t["x2"]), "y2": float(t["y2"]),
                "track_id": tid,
                "conf":     float(t["conf"]),
                "cls_id":   int(t["cls_id"]),
                "history":  list(self.track_history.get(tid, [])),
            }
            for tid, t in self.tracks.items()
            if t["lost"] == 0
        ]

    def get_history(self, track_id: int) -> list:
        return list(self.track_history.get(track_id, []))

    def cleanup(self):
        self.tracks.clear()
        self.track_history.clear()
