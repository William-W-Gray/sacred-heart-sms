import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { jwtDecode } from "jwt-decode";
import type { JWTPayload } from "@/types";

export const BASE_URL = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000");

// ── Token storage: sessionStorage (per-tab isolation) ────────────
// Tokens live in sessionStorage, NOT cookies/localStorage, on purpose:
// sessionStorage is scoped to a single tab, so logging in as a different
// user in another tab can never overwrite this tab's token (the old
// "admin tab silently became the student" bug) and a logout/refresh in
// one tab can't 401 every other tab. Tokens survive same-tab refresh /
// hard-refresh, but a brand-new tab or a reopened browser starts fresh.
const ACCESS_KEY  = "sms_access";
const REFRESH_KEY = "sms_refresh";

const store = () => (typeof window !== "undefined" ? window.sessionStorage : null);

export const getAccessToken  = () => store()?.getItem(ACCESS_KEY)  ?? null;
export const getRefreshToken = () => store()?.getItem(REFRESH_KEY) ?? null;

export const setTokens = (access: string, refresh: string) => {
  const s = store();
  if (!s) return;
  s.setItem(ACCESS_KEY, access);
  s.setItem(REFRESH_KEY, refresh);
};

export const clearTokens = () => {
  const s = store();
  s?.removeItem(ACCESS_KEY);
  s?.removeItem(REFRESH_KEY);
  purgeLegacyCookies();
};

// Earlier builds stored tokens in shared cookies. Any cookie left over
// from that scheme would re-introduce the cross-tab leak (and middleware
// would still see it), so strip them whenever we touch the session.
const purgeLegacyCookies = () => {
  if (typeof document === "undefined") return;
  for (const name of [ACCESS_KEY, REFRESH_KEY]) {
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
};
purgeLegacyCookies();

// Refresh token is gone/expired — wipe the session and bounce to login with
// a flag so the login page can explain *why* (instead of a silent redirect).
// Full reload re-inits the Zustand store from the now-cleared sessionStorage,
// and the on-/login guard below prevents a redirect loop.
const endSession = () => {
  clearTokens();
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem("sms-auth");
  if (window.location.pathname !== "/login") {
    window.location.href = "/login?session=expired";
  }
};

export const decodeToken = (token: string): JWTPayload => jwtDecode<JWTPayload>(token);

// ── Axios instance ───────────────────────────────────────────────
export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  // 30 s covers Render free-tier cold starts (~50 s max, but 30 s is a
  // reasonable UX ceiling — the skeleton + OfflineBanner handle the wait).
  timeout: 30_000,
});

// Request interceptor — attach Bearer token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — silent refresh on 401
let isRefreshing = false;
type QueueItem = { resolve: (v: string) => void; reject: (e: unknown) => void };
let failedQueue: QueueItem[] = [];

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean; _retryCount?: number };

    // ── Retry on transient network errors (e.g. ERR_NETWORK_CHANGED) ──
    // Only retry safe/idempotent methods and skip auth endpoints to avoid
    // double-login attempts. Max 2 retries with exponential backoff.
    const isNetworkError = !error.response && error.code !== "ECONNABORTED";
    const isSafeMethod   = ["get", "head", "options", "put", "patch"].includes(
      (original?.method ?? "").toLowerCase(),
    );
    const isAuthEndpoint = original?.url?.includes("/auth/");
    const retryCount     = original?._retryCount ?? 0;

    if (isNetworkError && isSafeMethod && !isAuthEndpoint && retryCount < 2) {
      original._retryCount = retryCount + 1;
      await new Promise((r) => setTimeout(r, 800 * original._retryCount!));
      return api(original);
    }

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      });
    }

    original._retry = true;
    isRefreshing    = true;

    const refresh = getRefreshToken();
    if (!refresh) {
      endSession();
      return Promise.reject(error);
    }

    try {
      const { data } = await axios.post(`${BASE_URL}/api/auth/refresh/`, { refresh });
      setTokens(data.access, refresh);
      processQueue(null, data.access);
      original.headers.Authorization = `Bearer ${data.access}`;
      return api(original);
    } catch (refreshError) {
      processQueue(refreshError, null);
      // Only clear session on an explicit server rejection (401/403).
      // A network error (no response) means the user is offline — keep
      // their tokens so they aren't logged out just for losing connectivity.
      const axiosErr = refreshError as AxiosError;
      if (axiosErr.response) {
        endSession();
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
