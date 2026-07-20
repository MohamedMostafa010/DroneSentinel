import axios from "axios";

const BASE = "http://localhost:8000";
const api = axios.create({ baseURL: BASE });

const TOKEN_KEY = "ds_access_token";
const REFRESH_KEY = "ds_refresh_token";

// ── Token helpers ─────────────────────────────────────────────────────────────
export const saveTokens = (accessToken, refreshToken) => {
  localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
};

export const clearTokens = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem("ds_role");
  localStorage.removeItem("ds_username");
};

export const getAccessToken = () => localStorage.getItem(TOKEN_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_KEY);

export const isAuthenticated = () => {
  const token = getAccessToken();
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
};

// ── Request interceptor: attach Bearer token ──────────────────────────────────
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: handle 401 (expired access token) ──────────────────
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (
      err.response?.status === 401 &&
      !original._retry &&
      original.url !== "/admin/login" &&
      original.url !== "/admin/refresh"
    ) {
      original._retry = true;
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${BASE}/admin/refresh`, {
            refresh_token: refreshToken,
          });
          saveTokens(data.access_token, null);
          original.headers["Authorization"] = `Bearer ${data.access_token}`;
          return api(original);
        } catch {
          clearTokens();
          window.location.href = "/login";
        }
      } else {
        clearTokens();
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

// ── Detection ──────────────────────────────────────────────────────────────────
export const startDetection        = (cfg)  => api.post("/detection/start", cfg);
export const stopDetection         = ()     => api.post("/detection/stop");
export const switchDetectionSource = (src)  => api.post("/detection/switch-source", { source: src });
export const previewSource         = (src)  => api.get("/detection/preview", { params: { source: src } });
export const setDetectAnnotate     = (val)  => api.post("/detection/set-annotate", { annotate: val });
export const setEmailLive          = (val)  => api.post("/detection/set-email", { enabled: val });
export const testSmtp              = (cfg)  => api.post("/detection/test-smtp", cfg);
export const getDetectionConfig    = ()     => api.get("/detection/config");
export const getDetectionStatus    = ()     => api.get("/detection/status");
export const getDetectionMetrics   = ()     => api.get("/detection/metrics");

// ── Training ───────────────────────────────────────────────────────────────────
export const startTraining      = (cfg)    => api.post("/training/start", cfg);
export const stopTraining       = ()       => api.post("/training/stop");
export const getTrainingStatus  = ()       => api.get("/training/status");
export const getTrainingMetrics = (runDir) => api.get("/training/metrics", { params: { run_dir: runDir } });
export const loadTrainingConfig = (path)   => api.get("/training/load-config", { params: { args_yaml: path } });
export const startEvaluate      = (cfg)    => api.post("/training/evaluate/start", cfg);
export const stopEvaluate       = ()       => api.post("/training/evaluate/stop");
export const getEvaluateStatus  = ()       => api.get("/training/evaluate/status");

// ── Analytics ──────────────────────────────────────────────────────────────────
export const getMetrics      = ()  => api.get("/analytics/metrics");
export const getLastSession  = ()  => api.get("/analytics/last-session");
export const takeSnapshot    = ()  => api.post("/analytics/snapshot");
export const exportCSV     = ()  => window.open(`${BASE}/analytics/export/csv`);
export const exportJSON    = ()  => window.open(`${BASE}/analytics/export/json`);
export const exportPDF     = ()  => window.open(`${BASE}/analytics/export/pdf`);
export const exportHTML    = ()  => window.open(`${BASE}/analytics/export/html`);

// ── Admin ──────────────────────────────────────────────────────────────────────
export const getAdminStatus      = ()           => api.get("/admin/status");
export const setupAdmin          = (pwd)        => api.post("/admin/setup", { password: pwd });
export const loginAdmin          = (pwd)        => api.post("/admin/login", { username: "admin", password: pwd });
export const loginUser           = (user, pwd)  => api.post("/admin/login", { username: user, password: pwd });
export const getUsers            = ()           => api.get("/admin/users");
export const createUser          = (u, p, r)    => api.post("/admin/users", { username: u, password: p, role: r });
export const updateUser          = (username, body) => api.put(`/admin/users/${username}`, body);
export const deleteUser          = (username)   => api.delete(`/admin/users/${username}`);
export const changePassword      = (cur, nw) =>
  api.post("/admin/change-password", { current_password: cur, new_password: nw });
export const getEncryptedFiles   = ()      => api.get("/admin/encrypted-files");
export const getAdminSettings    = ()      => api.get("/admin/settings");
export const updateAdminSettings = (s)     => api.put("/admin/settings", s);
export const exportAdminPDF      = ()      => window.open(`${BASE}/admin/export`);
export const getAuditLog         = ()      => api.get("/admin/audit-log");
export const getDetectionSessions = (limit = 50) =>
  api.get("/admin/sessions", { params: { limit } });
export const getSessionDrones    = (id)    => api.get(`/admin/sessions/${id}/drones`);

// ── Troubleshoot ───────────────────────────────────────────────────────────────
export const systemCheck       = ()    => api.get("/troubleshoot/system-check");
export const pingCamera        = (ip)  => api.post("/troubleshoot/ping", { ip });
export const startBenchmark    = (cfg) => api.post("/troubleshoot/benchmark/start", cfg);
export const stopBenchmark     = ()    => api.post("/troubleshoot/benchmark/stop");
export const getBenchmarkStatus = ()   => api.get("/troubleshoot/benchmark/status");

export default api;
