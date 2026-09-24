import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/server/db";
import { UserSession } from "@/lib/server/models/UserSession";
import { getAuth } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await connectDb();
  const auth = getAuth(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const sessions = await UserSession.find({ userId: auth.sub }).sort({ lastUsedAt: -1 }).lean();
  return NextResponse.json({
    sessions: sessions.map((s) => ({
      deviceId: s.deviceId,
      label: s.deviceLabel,
      lastUsedAt: s.lastUsedAt,
      isCurrent: s.deviceId === auth.deviceId,
    })),
  });
}
