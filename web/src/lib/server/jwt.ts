import jwt, { SignOptions } from "jsonwebtoken";
import crypto from "crypto";
import { getEnv } from "@/lib/server/env";
import { UserRole } from "@/lib/server/models/User";

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  branchId: string | null;
  deviceId: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const env = getEnv();
  const options: SignOptions = { expiresIn: env.JWT_ACCESS_TTL as SignOptions["expiresIn"] };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, getEnv().JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function refreshTtlMs(): number {
  const ttl = getEnv().JWT_REFRESH_TTL;
  const match = ttl.match(/^(\d+)([smhd])$/);
  if (!match) return 30 * 24 * 60 * 60 * 1000;
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * multipliers[unit];
}
