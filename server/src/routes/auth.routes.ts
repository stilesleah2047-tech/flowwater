import { Router } from "express";
import { z } from "zod";
import { User } from "@/models/User";
import { UserSession } from "@/models/UserSession";
import { Branch } from "@/models/Branch";
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshTtlMs,
} from "@/utils/jwt";
import { requireAuth } from "@/middleware/auth";
import { loginRateLimiter } from "@/middleware/rateLimit";
import { env } from "@/config/env";
import { logger } from "@/utils/logger";

export const authRouter = Router();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

const isProd = env.NODE_ENV === "production";
// SameSite=Lax cookies are NOT sent on cross-site fetch() calls — only on
// top-level navigations. Since the frontend (Vercel) and this API
// (Render) live on different domains in production, the session cookie
// must be SameSite=None to survive the cross-site request at all. None
// requires Secure, which is already true in production (HTTPS). Locally,
// frontend and API are both http://localhost on the same site, so Lax is
// fine there and avoids needing HTTPS in dev.
const crossSiteCookieOpts = isProd
  ? { secure: true, sameSite: "none" as const }
  : { secure: false, sameSite: "lax" as const };

const accessCookieOpts = {
  httpOnly: true,
  ...crossSiteCookieOpts,
  maxAge: 15 * 60 * 1000,
  path: "/",
};
function refreshCookieOpts() {
  return {
    httpOnly: true,
    ...crossSiteCookieOpts,
    maxAge: refreshTtlMs(),
    path: "/api/auth",
  };
}

async function issueSession(
  user: InstanceType<typeof User>,
  deviceId: string,
  deviceLabel: string | null
) {
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const expiresAt = new Date(Date.now() + refreshTtlMs());

  await UserSession.findOneAndUpdate(
    { userId: user._id, deviceId },
    { refreshTokenHash, expiresAt, deviceLabel, lastUsedAt: new Date() },
    { upsert: true, new: true }
  );

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    role: user.role,
    branchId: user.branchId ? user.branchId.toString() : null,
    deviceId,
  });

  return { accessToken, refreshToken };
}

/**
 * DEVICE BINDING: a DELIVERY account may have at most
 * env.DELIVERY_MAX_DEVICES (default 2) simultaneously active sessions,
 * counted by distinct deviceId. Only applied to DELIVERY — field staff
 * sharing/rotating phones is the scenario this guards against; branch
 * managers and the super admin aren't capped, since they're trusted named
 * individuals rather than a pool of field devices.
 */
async function enforceDeviceBinding(userId: string, deviceId: string) {
  const existing = await UserSession.find({ userId }).sort({ lastUsedAt: -1 }).lean();
  const alreadyBound = existing.some((s) => s.deviceId === deviceId);
  if (alreadyBound || existing.length < env.DELIVERY_MAX_DEVICES) {
    return { allowed: true as const };
  }
  return {
    allowed: false as const,
    activeDevices: existing.map((s) => ({
      deviceId: s.deviceId,
      label: s.deviceLabel,
      lastUsedAt: s.lastUsedAt,
    })),
  };
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceId: z.string().uuid(),
  deviceLabel: z.string().max(120).optional(),
});

/**
 * POST /api/auth/login
 *
 * The single entry point for every role. There is deliberately no
 * separate "admin" endpoint or route anymore — the person's email and
 * password ARE what determine where they land: the server looks up the
 * account, authenticates it, and returns a `redirectTo` computed from
 * that account's own role. The client never decides or guesses where to
 * go; it just follows the server's answer.
 */
authRouter.post("/login", loginRateLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }
  const { email, password, deviceId, deviceLabel } = parsed.data;

  const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  if (!user || !user.isActive) {
    return res.status(401).json({ error: "Incorrect email or password" });
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return res.status(423).json({ error: `Account locked. Try again in ${minutesLeft} minute(s).` });
  }

  const validPassword = await user.comparePassword(password);
  if (!validPassword) {
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      user.lockedUntil = new Date(Date.now() + LOCKOUT_MS);
      user.failedLoginAttempts = 0;
      logger.warn({ userId: user._id.toString() }, "account locked after repeated failed login attempts");
    }
    await user.save();
    return res.status(401).json({ error: "Incorrect email or password" });
  }

  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  await user.save();

  if (user.role === "DELIVERY") {
    const binding = await enforceDeviceBinding(user._id.toString(), deviceId);
    if (!binding.allowed) {
      return res.status(409).json({
        error: `This account is already active on ${env.DELIVERY_MAX_DEVICES} device(s). Log out one to continue.`,
        activeDevices: binding.activeDevices,
      });
    }
  }

  const { accessToken, refreshToken } = await issueSession(user, deviceId, deviceLabel ?? null);
  const branch = user.branchId ? await Branch.findById(user.branchId).lean() : null;

  res
    .cookie(ACCESS_COOKIE, accessToken, accessCookieOpts)
    .cookie(REFRESH_COOKIE, refreshToken, refreshCookieOpts())
    .json({
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        branchId: user.branchId,
        branchName: branch?.branchName ?? null,
        phoneNumber: user.phoneNumber,
        email: user.email,
      },
      redirectTo: user.role === "DELIVERY" ? "/terminal" : "/admin/dashboard",
    });
});

authRouter.post("/refresh", async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE];
  const deviceId = req.body?.deviceId as string | undefined;
  if (!refreshToken || !deviceId) {
    return res.status(401).json({ error: "No active session" });
  }

  const tokenHash = hashRefreshToken(refreshToken);
  const session = await UserSession.findOne({ deviceId, refreshTokenHash: tokenHash });
  if (!session || session.expiresAt.getTime() < Date.now()) {
    return res.status(401).json({ error: "Session expired. Please log in again." });
  }

  const user = await User.findById(session.userId);
  if (!user || !user.isActive) {
    await UserSession.deleteOne({ _id: session._id });
    return res.status(401).json({ error: "Account no longer active" });
  }

  const newRefreshToken = generateRefreshToken();
  session.refreshTokenHash = hashRefreshToken(newRefreshToken);
  session.lastUsedAt = new Date();
  session.expiresAt = new Date(Date.now() + refreshTtlMs());
  await session.save();

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    role: user.role,
    branchId: user.branchId ? user.branchId.toString() : null,
    deviceId,
  });

  res
    .cookie(ACCESS_COOKIE, accessToken, accessCookieOpts)
    .cookie(REFRESH_COOKIE, newRefreshToken, refreshCookieOpts())
    .json({ ok: true });
});

authRouter.post("/logout", requireAuth, async (req, res) => {
  await UserSession.deleteOne({ userId: req.auth!.sub, deviceId: req.auth!.deviceId });
  res.clearCookie(ACCESS_COOKIE, { path: "/" }).clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
  res.json({ ok: true });
});

authRouter.get("/sessions", requireAuth, async (req, res) => {
  const sessions = await UserSession.find({ userId: req.auth!.sub })
    .sort({ lastUsedAt: -1 })
    .lean();
  res.json({
    sessions: sessions.map((s) => ({
      deviceId: s.deviceId,
      label: s.deviceLabel,
      lastUsedAt: s.lastUsedAt,
      isCurrent: s.deviceId === req.auth!.deviceId,
    })),
  });
});

authRouter.delete("/sessions/:deviceId", requireAuth, async (req, res) => {
  await UserSession.deleteOne({ userId: req.auth!.sub, deviceId: req.params.deviceId });
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.auth!.sub).lean();
  if (!user || !user.isActive) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const branch = user.branchId ? await Branch.findById(user.branchId).lean() : null;
  res.json({
    user: {
      id: user._id,
      name: user.name,
      role: user.role,
      branchId: user.branchId,
      branchName: branch?.branchName ?? null,
      phoneNumber: user.phoneNumber,
      email: user.email,
    },
  });
});
