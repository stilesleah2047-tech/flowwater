import { getDeviceId } from "@/lib/deviceId";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(message: string, status: number, body?: any) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(API_URL + "/api/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: getDeviceId() }),
    })
      .then((r) => r.ok)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

/**
 * Thin fetch wrapper: always sends the httpOnly session cookies
 * (credentials: "include"), and on a 401 makes exactly one attempt to
 * silently refresh the access token before retrying — this is what keeps
 * a delivery worker's session alive through a full shift without
 * re-entering their PIN, per the "persistent sessions" requirement.
 */
export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {},
  _retried = false
): Promise<T> {
  const res = await fetch(API_URL + path, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 401 && !_retried && !path.startsWith("/api/auth/")) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return apiFetch<T>(path, options, true);
    }
  }

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json().catch(() => ({})) : null;

  if (!res.ok) {
    throw new ApiError(body?.error ?? "Request failed", res.status, body);
  }
  return body as T;
}

export function apiUrl(): string {
  return API_URL;
}
