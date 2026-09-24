import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDb } from "@/lib/server/db";
import { DailyInventory } from "@/lib/server/models/DailyInventory";
import { getAuth, requireRole, resolveBranchScope } from "@/lib/server/auth";

export const runtime = "nodejs";

function todayLocal(): string {
  return new Date().toISOString().slice(0, 10);
}

const countSchema = z.object({
  productId: z.string().min(1),
  eveningPhysicalCount: z.number().int().min(0),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  branchId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  await connectDb();
  const auth = getAuth(req);
  if (!requireRole(auth, "BRANCH_MANAGER", "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = countSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const branchId = resolveBranchScope(auth!, parsed.data.branchId);
  if (!branchId) return NextResponse.json({ error: "branchId is required" }, { status: 400 });

  const date = parsed.data.date ?? todayLocal();
  const row = await DailyInventory.findOneAndUpdate(
    { branchId, productId: parsed.data.productId, date },
    { eveningPhysicalCount: parsed.data.eveningPhysicalCount, recordedBy: auth!.sub },
    { upsert: true, new: true }
  );
  return NextResponse.json({ inventory: row });
}
