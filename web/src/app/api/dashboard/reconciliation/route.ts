import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/server/db";
import { Transaction } from "@/lib/server/models/Transaction";
import { DailyInventory } from "@/lib/server/models/DailyInventory";
import { getAuth, resolveBranchScope } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await connectDb();
  const auth = getAuth(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const branchId = resolveBranchScope(auth, req.nextUrl.searchParams.get("branchId"));
  const date = req.nextUrl.searchParams.get("date") || new Date().toISOString().slice(0, 10);

  const invMatch: Record<string, unknown> = { date };
  if (branchId) invMatch.branchId = new mongoose.Types.ObjectId(branchId);

  const inventoryRows = await DailyInventory.aggregate([
    { $match: invMatch },
    { $lookup: { from: "products", localField: "productId", foreignField: "_id", as: "product" } },
    { $unwind: "$product" },
    { $lookup: { from: "branches", localField: "branchId", foreignField: "_id", as: "branch" } },
    { $unwind: "$branch" },
    {
      $project: {
        _id: 0,
        branchId: 1,
        branchName: "$branch.branchName",
        productId: 1,
        productLabel: "$product.label",
        sizeLiters: "$product.sizeLiters",
        morningDispatched: 1,
        eveningPhysicalCount: 1,
      },
    },
  ]);

  const dayStart = new Date(date + "T00:00:00.000Z");
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const soldMatch: Record<string, unknown> = {
    createdAt: { $gte: dayStart, $lt: dayEnd },
    paymentStatus: "SUCCESS",
  };
  if (branchId) soldMatch.branchId = new mongoose.Types.ObjectId(branchId);

  const soldRows = await Transaction.aggregate([
    { $match: soldMatch },
    { $group: { _id: { branchId: "$branchId", productId: "$productId" }, totalSold: { $sum: "$quantity" } } },
  ]);
  const soldMap = new Map(
    soldRows.map((r) => [r._id.branchId.toString() + ":" + r._id.productId.toString(), r.totalSold as number])
  );

  const rows = inventoryRows.map((row: any) => {
    const key = row.branchId.toString() + ":" + row.productId.toString();
    const totalSold = soldMap.get(key) ?? 0;
    const expectedRemaining = row.morningDispatched - totalSold;
    const reconciledOk =
      row.eveningPhysicalCount != null ? row.eveningPhysicalCount === expectedRemaining : null;
    return { ...row, totalSold, expectedRemaining, reconciledOk };
  });

  return NextResponse.json({ date, rows });
}
