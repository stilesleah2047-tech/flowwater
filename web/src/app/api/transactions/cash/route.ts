import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDb } from "@/lib/server/db";
import { Transaction } from "@/lib/server/models/Transaction";
import { Product, BranchPricing } from "@/lib/server/models/Product";
import { getAuth, requireRole, resolveBranchScope } from "@/lib/server/auth";
import { normalizeKenyanPhone } from "@/lib/server/phone";

export const runtime = "nodejs";

const saleSchema = z.object({
  clientUuid: z.string().uuid(),
  customerName: z.string().trim().max(120).optional(),
  customerPhone: z.string().trim().min(9).max(15),
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(500),
  clientSubmittedAt: z.string().datetime().optional(),
});
const bodySchema = z.object({ sales: z.array(saleSchema).min(1).max(100) });

export async function POST(req: NextRequest) {
  await connectDb();
  const auth = getAuth(req);
  if (!requireRole(auth, "DELIVERY", "BRANCH_MANAGER")) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const normalized = Array.isArray(json?.sales) ? json : { sales: [json] };
  const parsed = bodySchema.safeParse(normalized);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const branchId = resolveBranchScope(auth!);
  if (!branchId) {
    return NextResponse.json({ error: "No active branch assignment for this account" }, { status: 403 });
  }

  const { sales } = parsed.data;
  const productIds = Array.from(new Set(sales.map((s) => s.productId)));
  const products = await Product.find({ _id: { $in: productIds } }).lean();
  const overrides = await BranchPricing.find({ branchId, productId: { $in: productIds } }).lean();
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));
  const overrideMap = new Map(overrides.map((o) => [o.productId.toString(), o.unitPrice]));

  const rejected: { clientUuid: string; error: string }[] = [];
  const inserted: any[] = [];

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

    try {
      const created = await Transaction.create({
        branchId,
        staffId: auth!.sub,
        customerName: sale.customerName ?? null,
        customerPhone: phone,
        productId: product._id,
        sizeLiters: product.sizeLiters,
        quantity: sale.quantity,
        unitPrice,
        amountTotal: Math.round(sale.quantity * unitPrice * 100) / 100,
        paymentMethod: "CASH",
        paymentStatus: "SUCCESS",
        clientUuid: sale.clientUuid,
        syncedFromOffline: !!sale.clientSubmittedAt,
        clientSubmittedAt: sale.clientSubmittedAt ? new Date(sale.clientSubmittedAt) : null,
      });
      inserted.push(created);
    } catch (err: any) {
      if (err?.code === 11000) continue;
      rejected.push({ clientUuid: sale.clientUuid, error: "Could not save this sale" });
    }
  }

  return NextResponse.json({ inserted, rejected });
}
