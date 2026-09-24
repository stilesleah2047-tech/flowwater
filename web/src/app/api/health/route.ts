import { NextResponse } from "next/server";
import { connectDb } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectDb();
    return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() });
  } catch (err: any) {
    return NextResponse.json({ status: "error", detail: err.message }, { status: 500 });
  }
}
