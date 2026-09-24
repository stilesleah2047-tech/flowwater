import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/server/db";
import { UserSession } from "@/lib/server/models/UserSession";
import { getAuth, ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  await connectDb();
  const auth = getAuth(req);

  const res = NextResponse.json({ ok: true });
  if (auth) {
    await UserSession.deleteOne({ userId: auth.sub, deviceId: auth.deviceId });
  }
  res.cookies.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { path: "/api/auth", maxAge: 0 });
  return res;
}
