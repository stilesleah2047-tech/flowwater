import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/server/db";
import { Transaction } from "@/lib/server/models/Transaction";
import { getAuth, resolveBranchScope } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function GET(req: NextRequest) {
  await connectDb();
  const auth = getAuth(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const branchId = resolveBranchScope(auth, req.nextUrl.searchParams.get("branchId"));
  const { start, end } = todayRange();

  const matchStage: Record<string, unknown> = { createdAt: { $gte: start, $lt: end } };
  if (branchId) matchStage.branchId = new mongoose.Types.ObjectId(branchId);

  const [totals] = await Transaction.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        cashTotal: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ["$paymentMethod", "CASH"] }, { $eq: ["$paymentStatus", "SUCCESS"] }] },
              "$amountTotal",
              0,
            ],
          },
        },
        mpesaTotal: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ["$paymentMethod", "MPESA"] }, { $eq: ["$paymentStatus", "SUCCESS"] }] },
              "$amountTotal",
              0,
            ],
          },
        },
        totalSales: { $sum: { $cond: [{ $eq: ["$paymentStatus", "SUCCESS"] }, 1, 0] } },
        pendingMpesa: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ["$paymentMethod", "MPESA"] }, { $eq: ["$paymentStatus", "PENDING"] }] },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  let branchRanking: any[] = [];
  if (!branchId) {
    branchRanking = await Transaction.aggregate([
      { $match: { createdAt: { $gte: start, $lt: end }, paymentStatus: "SUCCESS" } },
      {
        $group: {
          _id: "$branchId",
          revenue: { $sum: "$amountTotal" },
          salesCount: { $sum: 1 },
          cashTotal: { $sum: { $cond: [{ $eq: ["$paymentMethod", "CASH"] }, "$amountTotal", 0] } },
          mpesaTotal: { $sum: { $cond: [{ $eq: ["$paymentMethod", "MPESA"] }, "$amountTotal", 0] } },
        },
      },
      { $sort: { revenue: -1 } },
      { $lookup: { from: "branches", localField: "_id", foreignField: "_id", as: "branch" } },
      { $unwind: "$branch" },
      {
        $project: {
          _id: 0,
          branchId: "$_id",
          branchName: "$branch.branchName",
          locationCity: "$branch.locationCity",
          revenue: 1,
          salesCount: 1,
          cashTotal: 1,
          mpesaTotal: 1,
        },
      },
    ]);
  }

  return NextResponse.json({
    scope: branchId ? "branch" : "global",
    totals: totals ?? { cashTotal: 0, mpesaTotal: 0, totalSales: 0, pendingMpesa: 0 },
    branchRanking,
  });
}
