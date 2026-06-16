import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import type { JWTPayload } from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Token helpers ────────────────────────────────────────────────
export const getAccessToken  = () => Cookies.get("sms_access")  ?? null;
export const getRefreshToken = () => Cookies.get("sms_refresh") ?? null;

export const setTokens = (access: string, refresh: string) => {
  const decoded = jwtDecode<JWTPayload>(access);
  const expires = new Date(decoded.exp * 1000);
  const secure  = process.env.NODE_ENV === "production";
  Cookies.set("sms_access",  access,  { expires, sameSite: "strict", secure });
  Cookies.set("sms_refresh", refresh, { expires: 30, sameSite: "strict", secure });
};

export const clearTokens = () => {
  Cookies.remove("sms_access");
  Cookies.remove("sms_refresh");
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
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

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
      clearTokens();
      window.location.href = "/login";
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
        clearTokens();
        window.location.href = "/login";
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
