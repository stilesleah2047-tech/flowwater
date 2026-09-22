import jwt, { SignOptions } from "jsonwebtoken";
import crypto from "crypto";
import { env } from "@/config/env";
import { UserRole } from "@/models/User";

export interface AccessTokenPayload {
  sub: string; // user id
  role: UserRole;
  branchId: string | null;
  deviceId: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: SignOptions = { expiresIn: env.JWT_ACCESS_TTL as SignOptions["expiresIn"] };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

/**
 * Refresh tokens are opaque random strings, NOT JWTs — the server never
 * needs to decode one client-side; it only ever looks up the matching
 * UserSession row by hash. This means a refresh token is meaningless
 * without the database record backing it, so revoking a session (device
 * logout, admin-forced logout, device-limit eviction) takes effect
 * immediately, unlike a stateless JWT which would remain valid until
 * expiry regardless of revocation.
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function refreshTtlMs(): number {
  const match = env.JWT_REFRESH_TTL.match(/^(\d+)([smhd])$/);
  if (!match) return 30 * 24 * 60 * 60 * 1000; // fallback: 30 days
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return value * multipliers[unit];
}
