import { AxiosError } from "axios";
import { BASE_URL } from "@/lib/api/client";

function formatFieldName(key: string): string {
  return key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

const LOCALHOST_NAMES = new Set(["localhost", "127.0.0.1"]);

/**
 * Dev-only diagnostic for the #1 cause of "login works on my laptop but
 * gets a network error on my phone": NEXT_PUBLIC_API_URL is still
 * "localhost", which on the phone resolves to the phone itself, not the
 * dev machine, because the JS bundle's API calls are baked in at build
 * time. True on a real device when the page itself was reached via a LAN
 * IP/hostname but the configured API target was not.
 */
function isLikelyLocalhostOnPhoneMismatch(): boolean {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return false;
  try {
    const apiHost = new URL(BASE_URL).hostname;
    return LOCALHOST_NAMES.has(apiHost) && !LOCALHOST_NAMES.has(window.location.hostname);
  } catch {
    return false;
  }
}

export function isNetworkError(err: unknown): boolean {
  if (!(err instanceof AxiosError)) return false;
  return !err.response;
}

/**
 * Retries `fn` on network/timeout errors (no response received) with
 * 2 s → 4 s backoff. Never retries once the server has actually responded
 * (4xx/5xx) — those won't change on retry. Mirrors the mutation retry
 * policy in providers.tsx for calls that sit outside TanStack Query
 * (e.g. login, which runs before any query client work matters).
 */
export async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isNetworkError(err) || attempt >= retries) throw err;
      await new Promise((resolve) => setTimeout(resolve, 2_000 * 2 ** attempt));
    }
  }
}

/**
 * Turns an Axios error from the DRF API into a user-facing message.
 * Distinguishes offline vs timeout vs server errors.
 */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof AxiosError)) return fallback;

  if (err.response?.status === 429) {
    return "Too many attempts. Please wait a moment and try again.";
  }

  if (!err.response) {
    // ECONNABORTED = axios timeout; ERR_NETWORK = truly offline
    if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
      return "Request timed out — the server is taking longer than usual. Please try again.";
    }
    if (isLikelyLocalhostOnPhoneMismatch()) {
      return (
        `Can't reach the API at ${BASE_URL} from this device. ` +
        "NEXT_PUBLIC_API_URL is still set to localhost, which only works on the dev machine itself. " +
        "To test on a phone: set NEXT_PUBLIC_API_URL to your computer's LAN IP (e.g. http://192.168.x.x:8000), " +
        "and add that IP to the backend's ALLOWED_HOSTS and CORS_ALLOWED_ORIGINS env vars."
      );
    }
    return "No connection — please check your internet and try again.";
  }

  const data = err.response.data;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (typeof obj.detail === "string") return obj.detail;

    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value) && typeof value[0] === "string") {
        return key === "non_field_errors" ? value[0] : `${formatFieldName(key)}: ${value[0]}`;
      }
    }
  }

  if (err.response.status >= 500) {
    return "Server error — please try again in a moment.";
  }

  return fallback;
}
