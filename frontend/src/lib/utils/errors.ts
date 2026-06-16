import { AxiosError } from "axios";

function formatFieldName(key: string): string {
  return key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export function isNetworkError(err: unknown): boolean {
  if (!(err instanceof AxiosError)) return false;
  return !err.response;
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
