import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/server/db";
import { Transaction } from "@/lib/server/models/Transaction";
import { getAuth, resolveBranchScope } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await connectDb();
  const auth = getAuth(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const branchId = resolveBranchScope(auth, req.nextUrl.searchParams.get("branchId"));
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 50, 200);

  const filter: Record<string, unknown> = {};
  if (branchId) filter.branchId = branchId;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  filter.createdAt = { $gte: startOfDay };

  const transactions = await Transaction.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("branchId", "branchName")
    .lean();

  return NextResponse.json({ transactions });
}
