import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDb } from "@/lib/server/db";
import { User } from "@/lib/server/models/User";
import { UserSession } from "@/lib/server/models/UserSession";
import { Branch } from "@/lib/server/models/Branch";
import { signAccessToken, generateRefreshToken, hashRefreshToken, refreshTtlMs } from "@/lib/server/jwt";
import { ACCESS_COOKIE, REFRESH_COOKIE, accessCookieOptions, refreshCookieOptions } from "@/lib/server/auth";
import { getEnv } from "@/lib/server/env";

export const runtime = "nodejs";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceId: z.string().uuid(),
  deviceLabel: z.string().max(120).optional(),
});

async function enforceDeviceBinding(userId: string, deviceId: string) {
  const env = getEnv();
  const existing = await UserSession.find({ userId }).sort({ lastUsedAt: -1 }).lean();
  const alreadyBound = existing.some((s) => s.deviceId === deviceId);
  if (alreadyBound || existing.length < env.DELIVERY_MAX_DEVICES) {
    return { allowed: true as const };
  }
  return {
    allowed: false as const,
    activeDevices: existing.map((s) => ({ deviceId: s.deviceId, label: s.deviceLabel, lastUsedAt: s.lastUsedAt })),
  };
}

export async function POST(req: NextRequest) {
  await connectDb();

  const json = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const { email, password, deviceId, deviceLabel } = parsed.data;

  const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return NextResponse.json({ error: `Account locked. Try again in ${minutesLeft} minute(s).` }, { status: 423 });
  }

  const validPassword = await user.comparePassword(password);
  if (!validPassword) {
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      user.lockedUntil = new Date(Date.now() + LOCKOUT_MS);
      user.failedLoginAttempts = 0;
    }
    await user.save();
    return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });
  }

  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  await user.save();

  if (user.role === "DELIVERY") {
    const binding = await enforceDeviceBinding(user._id.toString(), deviceId);
    if (!binding.allowed) {
      return NextResponse.json(
        {
          error: `This account is already active on ${getEnv().DELIVERY_MAX_DEVICES} device(s). Log out one to continue.`,
          activeDevices: binding.activeDevices,
        },
        { status: 409 }
      );
    }
  }

  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const expiresAt = new Date(Date.now() + refreshTtlMs());

  await UserSession.findOneAndUpdate(
    { userId: user._id, deviceId },
    { refreshTokenHash, expiresAt, deviceLabel: deviceLabel ?? null, lastUsedAt: new Date() },
    { upsert: true, new: true }
  );

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    role: user.role,
    branchId: user.branchId ? user.branchId.toString() : null,
    deviceId,
  });

  const branch = user.branchId ? await Branch.findById(user.branchId).lean() : null;

  const res = NextResponse.json({
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

  res.cookies.set(ACCESS_COOKIE, accessToken, accessCookieOptions());
  res.cookies.set(REFRESH_COOKIE, refreshToken, refreshCookieOptions(Math.floor(refreshTtlMs() / 1000)));
  return res;
}
