import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDb } from "@/lib/server/db";
import { Transaction } from "@/lib/server/models/Transaction";
import { Product, BranchPricing } from "@/lib/server/models/Product";
import { Branch } from "@/lib/server/models/Branch";
import { getAuth, requireRole, resolveBranchScope } from "@/lib/server/auth";
import { normalizeKenyanPhone } from "@/lib/server/phone";
import { initiateStkPush } from "@/lib/server/mpesa";

export const runtime = "nodejs";

const stkSchema = z.object({
  customerName: z.string().trim().max(120).optional(),
  customerPhone: z.string().trim().min(9).max(15),
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(500),
});

const hits = new Map<string, { count: number; resetAt: number }>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  if (entry.count >= 5) return true;
  entry.count += 1;
  return false;
}

export async function POST(req: NextRequest) {
  await connectDb();
  const auth = getAuth(req);
  if (!requireRole(auth, "DELIVERY", "BRANCH_MANAGER")) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (rateLimited(auth!.sub)) {
    return NextResponse.json(
      { error: "Too many payment prompts sent recently. Wait a moment and try again." },
      { status: 429 }
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = stkSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const branchId = resolveBranchScope(auth!);
  if (!branchId) {
    return NextResponse.json({ error: "No active branch assignment for this account" }, { status: 403 });
  }

  const { customerName, customerPhone, productId, quantity } = parsed.data;

  let phone: string;
  try {
    phone = normalizeKenyanPhone(customerPhone);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }

  const product = await Product.findById(productId).lean();
  if (!product || !product.isActive) {
    return NextResponse.json({ error: "Selected product is not available" }, { status: 400 });
  }
  const override = await BranchPricing.findOne({ branchId, productId }).lean();
  const unitPrice = override?.unitPrice ?? product.unitPrice;
  const amount = Math.round(quantity * unitPrice * 100) / 100;
  if (amount <= 0) {
    return NextResponse.json({ error: "Invalid sale amount" }, { status: 400 });
  }

  const branch = await Branch.findById(branchId).lean();

  const txn = await Transaction.create({
    branchId,
    staffId: auth!.sub,
    customerName: customerName ?? null,
    customerPhone: phone,
    productId: product._id,
    sizeLiters: product.sizeLiters,
    quantity,
    unitPrice,
    amountTotal: amount,
    paymentMethod: "MPESA",
    paymentStatus: "PENDING",
    clientUuid: `mpesa-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  });

  try {
    const stk = await initiateStkPush({
      phone,
      amount,
      accountReference: branch?.branchName ?? "AquaFlow",
      transactionDesc: `${quantity}x${product.sizeLiters}L`,
    });

    if (stk.ResponseCode !== "0") {
      txn.paymentStatus = "FAILED";
      txn.mpesaDetails.resultDesc = stk.ResponseDescription;
      await txn.save();
      return NextResponse.json({ error: stk.ResponseDescription || "Payment prompt was rejected" }, { status: 502 });
    }

    txn.mpesaDetails.checkoutRequestId = stk.CheckoutRequestID;
    txn.mpesaDetails.merchantRequestId = stk.MerchantRequestID;
    await txn.save();

    return NextResponse.json({
      transactionId: txn._id,
      checkoutRequestId: stk.CheckoutRequestID,
      customerMessage: stk.CustomerMessage,
    });
  } catch (err: any) {
    txn.paymentStatus = "FAILED";
    txn.mpesaDetails.resultDesc = err?.response?.data?.errorMessage ?? err.message;
    await txn.save();
    return NextResponse.json({ error: "Could not reach M-Pesa. Please retry." }, { status: 502 });
  }
}
