import { Router } from "express";
import mongoose from "mongoose";
import { Transaction } from "@/models/Transaction";
import { DailyInventory } from "@/models/DailyInventory";
import { requireAuth, resolveBranchScope } from "@/middleware/auth";

export const dashboardRouter = Router();

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

dashboardRouter.get("/summary", requireAuth, async (req, res) => {
  const branchId = resolveBranchScope(req, req.query.branchId as string | undefined);
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

  res.json({
    scope: branchId ? "branch" : "global",
    totals: totals ?? { cashTotal: 0, mpesaTotal: 0, totalSales: 0, pendingMpesa: 0 },
    branchRanking,
  });
});

dashboardRouter.get("/reconciliation", requireAuth, async (req, res) => {
  const branchId = resolveBranchScope(req, req.query.branchId as string | undefined);
  const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);

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

  const rows = inventoryRows.map((row) => {
    const key = row.branchId.toString() + ":" + row.productId.toString();
    const totalSold = soldMap.get(key) ?? 0;
    const expectedRemaining = row.morningDispatched - totalSold;
    const reconciledOk =
      row.eveningPhysicalCount != null ? row.eveningPhysicalCount === expectedRemaining : null;
    return { ...row, totalSold, expectedRemaining, reconciledOk };
  });

  res.json({ date, rows });
});
