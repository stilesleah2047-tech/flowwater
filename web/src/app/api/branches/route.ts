import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDb } from "@/lib/server/db";
import { Branch } from "@/lib/server/models/Branch";
import { getAuth, requireRole } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await connectDb();
  const auth = getAuth(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (auth.role === "SUPER_ADMIN") {
    const branches = await Branch.find().sort({ branchName: 1 }).lean();
    return NextResponse.json({ branches });
  }
  if (!auth.branchId) return NextResponse.json({ branches: [] });
  const branch = await Branch.findById(auth.branchId).lean();
  return NextResponse.json({ branches: branch ? [branch] : [] });
}

const createSchema = z.object({
  branchName: z.string().trim().min(1).max(120),
  locationCity: z.string().trim().min(1).max(120),
});

export async function POST(req: NextRequest) {
  await connectDb();
  const auth = getAuth(req);
  if (!requireRole(auth, "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const branch = await Branch.create(parsed.data);
  return NextResponse.json({ branch }, { status: 201 });
}
