import { AxiosError } from "axios";

function formatFieldName(key: string): string {
  return key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/**
 * Turns an Axios error from the DRF API into an informative, user-facing
 * message. Falls back to `fallback` when the response body doesn't carry
 * anything more specific.
 */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof AxiosError)) return fallback;

  if (err.response?.status === 429) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (!err.response) {
    return "Network error — check your connection and try again.";
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
    return "Server error. Please try again later.";
  }

  return fallback;
}
