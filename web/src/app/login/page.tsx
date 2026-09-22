"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { getDeviceId, getDeviceLabel } from "@/lib/deviceId";

interface ActiveDevice {
  deviceId: string;
  label: string | null;
  lastUsedAt: string;
}

const BACKGROUND_IMAGE_URL =
  "https://images.unsplash.com/photo-1519692933481-e162a57d6721?q=80&w=2070&auto=format&fit=crop";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceConflict, setDeviceConflict] = useState<ActiveDevice[] | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDeviceConflict(null);
    setLoading(true);

    try {
      const result = await apiFetch<{ redirectTo: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          deviceId: getDeviceId(),
          deviceLabel: getDeviceLabel(),
        }),
      });
      router.replace(result.redirectTo);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setDeviceConflict((err.body?.activeDevices as ActiveDevice[]) ?? []);
        setError(err.message);
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    }
    setLoading(false);
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      <div className="absolute inset-0 -z-20">
        <img src={BACKGROUND_IMAGE_URL} alt="" aria-hidden className="h-full w-full object-cover" />
      </div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-depth-950/90 via-depth-900/80 to-depth-950/95" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-tr from-flow-600/20 via-transparent to-transparent" />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 left-1/2 -z-10 aspect-square w-[140%] -translate-x-1/2 rounded-full bg-flow-500/10 blur-3xl"
      />

      <div className="relative w-full max-w-md animate-fade-up">
        <div className="rounded-2xl border border-white/15 bg-white/[0.07] p-8 shadow-2xl backdrop-blur-2xl sm:p-10">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-flow-400 to-flow-600 shadow-lg shadow-flow-500/30">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C12 2 5 11.5 5 16a7 7 0 0 0 14 0c0-4.5-7-14-7-14Z" fill="white" />
              </svg>
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-white">AquaFlow</h1>
            <p className="mt-1.5 text-sm text-sand-200/70">Sign in to continue</p>
          </div>

          {deviceConflict ? (
            <div className="rounded-xl2 border border-alert-500/30 bg-alert-500/10 p-4">
              <p className="text-sm text-alert-400">{error}</p>
              <ul className="mt-3 space-y-2">
                {deviceConflict.map((d) => (
                  <li key={d.deviceId} className="rounded-lg bg-white/5 px-3 py-2 text-sm text-sand-100">
                    {d.label ?? "Unknown device"} · last used {new Date(d.lastUsedAt).toLocaleString()}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => {
                  setDeviceConflict(null);
                  setError(null);
                }}
                className="tap-target mt-4 w-full rounded-xl2 bg-white/10 text-sm font-medium text-white hover:bg-white/15"
              >
                Back
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-sand-100">
                  Email
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sand-200/40">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M4 6h16v12H4V6Zm0 0 8 7 8-7"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="tap-target w-full rounded-xl2 border border-white/15 bg-white/5 pl-11 pr-4 text-white placeholder:text-white/30 transition focus:border-flow-400 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-flow-500/30"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-sand-100">
                  Password
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sand-200/40">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
                      <path d="M8 10V7a4 4 0 1 1 8 0v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    </svg>
                  </span>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="tap-target w-full rounded-xl2 border border-white/15 bg-white/5 pl-11 pr-11 text-white transition focus:border-flow-400 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-flow-500/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-3.5 flex items-center text-sand-200/50 hover:text-sand-200"
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.5 5.2A10.8 10.8 0 0 1 12 5c5 0 9 4 10 7-.4 1.1-1.1 2.3-2.1 3.4M6.6 6.6C4.6 8 3.2 9.9 2 12c1 3 5 7 10 7 1.3 0 2.5-.2 3.6-.7"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <p role="alert" className="rounded-lg bg-alert-500/10 px-3 py-2 text-sm text-alert-400">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="tap-target group relative w-full overflow-hidden rounded-xl2 bg-gradient-to-r from-flow-500 to-flow-600 font-display font-semibold text-depth-950 shadow-lg shadow-flow-500/20 transition active:scale-[0.98] disabled:opacity-60"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-depth-950/30 border-t-depth-950" />
                  )}
                  {loading ? "Signing in…" : "Sign in"}
                </span>
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-sand-200/40">
          Water delivery, unified — cash and M-Pesa, every branch, one system.
        </p>
      </div>
    </main>
  );
}
