import { Router } from "express";
import { z } from "zod";
import { Transaction } from "@/models/Transaction";
import { Product, BranchPricing } from "@/models/Product";
import { requireAuth, requireRole, resolveBranchScope } from "@/middleware/auth";
import { normalizeKenyanPhone } from "@/utils/phone";
import { logger } from "@/utils/logger";

export const transactionsRouter = Router();

const saleSchema = z.object({
  clientUuid: z.string().uuid(),
  customerName: z.string().trim().max(120).optional(),
  customerPhone: z.string().trim().min(9).max(15),
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(500),
  // Informational only — the device's own clock at time of sale, used
  // purely for offline-queue ordering in the UI. NEVER trusted as the
  // authoritative sale time; see clientSubmittedAt on the Transaction
  // model for why. Deliberately NOT used anywhere below to set createdAt.
  clientSubmittedAt: z.string().datetime().optional(),
});

const bodySchema = z.object({ sales: z.array(saleSchema).min(1).max(100) });

/**
 * POST /api/transactions/cash
 * Body: { sales: CashSalePayload[] }
 *
 * "Record Cash Sale" posts a single-item array immediately when online.
 * The device's offline queue also calls this with multiple queued items
 * in one batch once connectivity returns.
 *
 * TAMPER PREVENTION: the sale's authoritative time is set here from the
 * SERVER's Date.now() (Mongoose's `timestamps: true` on the Transaction
 * schema) — the request body's `clientSubmittedAt` is stored alongside
 * for reference but never used for `createdAt`, so a delivery worker
 * changing their phone's clock cannot forge when a sale happened.
 */
transactionsRouter.post("/cash", requireAuth, requireRole("DELIVERY", "BRANCH_MANAGER"), async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }

  const branchId = resolveBranchScope(req); // staff are hard-locked to their own token's branchId
  if (!branchId) {
    return res.status(403).json({ error: "No active branch assignment for this account" });
  }

  const { sales } = parsed.data;
  const productIds = Array.from(new Set(sales.map((s) => s.productId)));

  const products = await Product.find({ _id: { $in: productIds } }).lean();
  const overrides = await BranchPricing.find({ branchId, productId: { $in: productIds } }).lean();
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));
  const overrideMap = new Map(overrides.map((o) => [o.productId.toString(), o.unitPrice]));

  const docs: any[] = [];
  const rejected: { clientUuid: string; error: string }[] = [];

  for (const sale of sales) {
    let phone: string;
    try {
      phone = normalizeKenyanPhone(sale.customerPhone);
    } catch (e: any) {
      rejected.push({ clientUuid: sale.clientUuid, error: e.message });
      continue;
    }

    const product = productMap.get(sale.productId);
    if (!product || !product.isActive) {
      rejected.push({ clientUuid: sale.clientUuid, error: "Product not available" });
      continue;
    }

    const unitPrice = overrideMap.get(sale.productId) ?? product.unitPrice;

    docs.push({
      branchId,
      staffId: req.auth!.sub,
      customerName: sale.customerName ?? null,
      customerPhone: phone,
      productId: product._id,
      sizeLiters: product.sizeLiters,
      quantity: sale.quantity,
      unitPrice,
      amountTotal: Math.round(sale.quantity * unitPrice * 100) / 100,
      paymentMethod: "CASH",
      paymentStatus: "SUCCESS", // cash is confirmed the instant it's handed over
      clientUuid: sale.clientUuid,
      syncedFromOffline: !!sale.clientSubmittedAt,
      clientSubmittedAt: sale.clientSubmittedAt ? new Date(sale.clientSubmittedAt) : null,
      // createdAt intentionally omitted — Mongoose timestamps sets it from
      // the server clock at insert time.
    });
  }

  if (docs.length === 0) {
    return res.status(400).json({ inserted: [], rejected });
  }

  // Idempotent insert: a replayed offline batch (client_uuid already
  // present) is silently skipped per-document rather than failing the
  // whole batch.
  const inserted: any[] = [];
  for (const doc of docs) {
    try {
      const created = await Transaction.create(doc);
      inserted.push(created);
    } catch (err: any) {
      if (err?.code === 11000) {
        // duplicate clientUuid — already recorded, not an error worth surfacing
        continue;
      }
      logger.error({ err: err?.message, branchId }, "cash sale insert failed");
      rejected.push({ clientUuid: doc.clientUuid, error: "Could not save this sale" });
    }
  }

  logger.info({ branchId, inserted: inserted.length, rejected: rejected.length }, "cash sale batch processed");
  res.json({ inserted, rejected });
});

/** GET /api/transactions — recent transactions, branch-scoped (SUPER_ADMIN may pass ?branchId=). */
transactionsRouter.get("/", requireAuth, async (req, res) => {
  const branchId = resolveBranchScope(req, req.query.branchId as string | undefined);
  const limit = Math.min(Number(req.query.limit) || 50, 200);

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

  res.json({ transactions });
});
