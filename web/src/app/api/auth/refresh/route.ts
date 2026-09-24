import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/server/db";
import { User } from "@/lib/server/models/User";
import { UserSession } from "@/lib/server/models/UserSession";
import { signAccessToken, generateRefreshToken, hashRefreshToken, refreshTtlMs } from "@/lib/server/jwt";
import { ACCESS_COOKIE, REFRESH_COOKIE, accessCookieOptions, refreshCookieOptions } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  await connectDb();

  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  const body = await req.json().catch(() => ({}));
  const deviceId = body?.deviceId as string | undefined;
  if (!refreshToken || !deviceId) {
    return NextResponse.json({ error: "No active session" }, { status: 401 });
  }

  const tokenHash = hashRefreshToken(refreshToken);
  const session = await UserSession.findOne({ deviceId, refreshTokenHash: tokenHash });
  if (!session || session.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Session expired. Please log in again." }, { status: 401 });
  }

  const user = await User.findById(session.userId);
  if (!user || !user.isActive) {
    await UserSession.deleteOne({ _id: session._id });
    return NextResponse.json({ error: "Account no longer active" }, { status: 401 });
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

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE, accessToken, accessCookieOptions());
  res.cookies.set(REFRESH_COOKIE, newRefreshToken, refreshCookieOptions(Math.floor(refreshTtlMs() / 1000)));
  return res;
}
