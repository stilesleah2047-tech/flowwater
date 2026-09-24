import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/server/db";
import { UserSession } from "@/lib/server/models/UserSession";
import { getAuth } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function DELETE(req: NextRequest, { params }: { params: { deviceId: string } }) {
  await connectDb();
  const auth = getAuth(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  await UserSession.deleteOne({ userId: auth.sub, deviceId: params.deviceId });
  return NextResponse.json({ ok: true });
}
