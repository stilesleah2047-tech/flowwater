const STORAGE_KEY = "aquaflow_device_id";

/**
 * A stable per-device identifier the server uses for device binding (max
 * simultaneous DELIVERY sessions) and refresh-token session tracking.
 * Persisted in localStorage — NOT sessionStorage or an in-memory variable
 * — precisely because it must survive the browser/PWA being closed and
 * reopened; that persistence is exactly what makes it "this device"
 * rather than "this tab".
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

export function getDeviceLabel(): string {
  if (typeof navigator === "undefined") return "Unknown device";
  const ua = navigator.userAgent;
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad/i.test(ua);
  const browser = /Chrome/i.test(ua) ? "Chrome" : /Firefox/i.test(ua) ? "Firefox" : /Safari/i.test(ua) ? "Safari" : "Browser";
  const platform = isAndroid ? "Android" : isIOS ? "iOS" : "Desktop";
  return browser + " on " + platform;
}
