import { NextRequest } from "next/server";
import { verifyAccessToken, AccessTokenPayload } from "@/lib/server/jwt";
import { UserRole } from "@/lib/server/models/User";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

export function getAuth(req: NextRequest): AccessTokenPayload | null {
  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  try {
    return verifyAccessToken(token);
  } catch {
    return null;
  }
}

export function requireRole(auth: AccessTokenPayload | null, ...roles: UserRole[]): boolean {
  if (!auth) return false;
  return roles.includes(auth.role);
}

export function resolveBranchScope(auth: AccessTokenPayload, requestedBranchId?: string | null): string | null {
  if (auth.role === "SUPER_ADMIN") {
    return requestedBranchId && requestedBranchId !== "ALL" ? requestedBranchId : null;
  }
  return auth.branchId;
}

export function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Cookie options for both session cookies. Since the frontend and API now
 * live in the SAME Next.js app on the SAME Vercel domain, these are
 * always same-site — no SameSite=None/cross-site complexity needed here,
 * unlike the earlier split Vercel+Render deployment.
 */
export function accessCookieOptions() {
  return {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax" as const,
    maxAge: 15 * 60,
    path: "/",
  };
}

export function refreshCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax" as const,
    maxAge: maxAgeSeconds,
    path: "/api/auth",
  };
}
