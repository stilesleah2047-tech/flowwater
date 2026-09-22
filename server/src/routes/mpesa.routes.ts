import { Router, Request } from "express";
import { z } from "zod";
import { Transaction } from "@/models/Transaction";
import { Product, BranchPricing } from "@/models/Product";
import { Branch } from "@/models/Branch";
import { MpesaCallbackLog } from "@/models/MpesaCallbackLog";
import { requireAuth, requireRole, resolveBranchScope } from "@/middleware/auth";
import { stkPushRateLimiter } from "@/middleware/rateLimit";
import { normalizeKenyanPhone } from "@/utils/phone";
import { initiateStkPush, queryStkStatus } from "@/utils/mpesa";
import { env } from "@/config/env";
import { logger } from "@/utils/logger";
import { emitTransactionEvent } from "@/sockets";

export const mpesaRouter = Router();

const stkSchema = z.object({
  customerName: z.string().trim().max(120).optional(),
  customerPhone: z.string().trim().min(9).max(15),
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(500),
});

mpesaRouter.post(
  "/stkpush",
  requireAuth,
  requireRole("DELIVERY", "BRANCH_MANAGER"),
  stkPushRateLimiter,
  async (req, res) => {
    const parsed = stkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    }

    const branchId = resolveBranchScope(req);
    if (!branchId) {
      return res.status(403).json({ error: "No active branch assignment for this account" });
    }

    const { customerName, customerPhone, productId, quantity } = parsed.data;

    let phone: string;
    try {
      phone = normalizeKenyanPhone(customerPhone);
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }

    const product = await Product.findById(productId).lean();
    if (!product || !product.isActive) {
      return res.status(400).json({ error: "Selected product is not available" });
    }
    const override = await BranchPricing.findOne({ branchId, productId }).lean();
    const unitPrice = override?.unitPrice ?? product.unitPrice;
    const amount = Math.round(quantity * unitPrice * 100) / 100;
    if (amount <= 0) {
      return res.status(400).json({ error: "Invalid sale amount" });
    }

    const branch = await Branch.findById(branchId).lean();

    const txn = await Transaction.create({
      branchId,
      staffId: req.auth!.sub,
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
    emitTransactionEvent("created", txn);

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
        emitTransactionEvent("updated", txn);
        logger.error({ txnId: txn._id.toString(), stk }, "stk push rejected by daraja");
        return res.status(502).json({ error: stk.ResponseDescription || "Payment prompt was rejected" });
      }

      txn.mpesaDetails.checkoutRequestId = stk.CheckoutRequestID;
      txn.mpesaDetails.merchantRequestId = stk.MerchantRequestID;
      await txn.save();

      logger.info(
        { txnId: txn._id.toString(), checkoutRequestId: stk.CheckoutRequestID, branchId },
        "stk push initiated"
      );

      res.json({
        transactionId: txn._id,
        checkoutRequestId: stk.CheckoutRequestID,
        customerMessage: stk.CustomerMessage,
      });
    } catch (err: any) {
      txn.paymentStatus = "FAILED";
      txn.mpesaDetails.resultDesc = err?.response?.data?.errorMessage ?? err.message;
      await txn.save();
      emitTransactionEvent("updated", txn);
      logger.error({ txnId: txn._id.toString(), err: err?.message }, "stk push threw");
      res.status(502).json({ error: "Could not reach M-Pesa. Please retry." });
    }
  }
);

mpesaRouter.get("/status/:transactionId", requireAuth, async (req, res) => {
  const txn = await Transaction.findById(req.params.transactionId);
  if (!txn) return res.status(404).json({ error: "Transaction not found" });

  const ageMs = Date.now() - txn.createdAt.getTime();
  if (txn.paymentStatus === "PENDING" && txn.mpesaDetails.checkoutRequestId && ageMs > 15000) {
    try {
      const result = await queryStkStatus(txn.mpesaDetails.checkoutRequestId);
      const code = Number(result.ResultCode);
      if (!Number.isNaN(code) && code !== 1032) {
        const fresh = await Transaction.findOne({ _id: txn._id, paymentStatus: "PENDING" });
        if (fresh) {
          fresh.paymentStatus = code === 0 ? "SUCCESS" : "FAILED";
          fresh.mpesaDetails.resultCode = code;
          fresh.mpesaDetails.resultDesc = result.ResultDesc;
          await fresh.save();
          emitTransactionEvent("updated", fresh);
          return res.json(fresh);
        }
      }
    } catch {
      // Daraja query failed/still pending — fall through and return current row.
    }
  }

  res.json(txn);
});

function getSourceIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0].trim();
  return req.socket.remoteAddress ?? "unknown";
}

function isIpAllowed(ip: string): boolean {
  const allowlist = env.DARAJA_CALLBACK_IP_ALLOWLIST;
  if (!allowlist) return true;
  return allowlist.split(",").map((s) => s.trim()).includes(ip);
}

mpesaRouter.post("/callback", async (req, res) => {
  const ack = () => res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  const sourceIp = getSourceIp(req);
  const payload = req.body;

  const callback = payload?.Body?.stkCallback;
  const checkoutRequestId: string | undefined = callback?.CheckoutRequestID;
  const resultCode: number | undefined = callback?.ResultCode;
  const resultDesc: string = callback?.ResultDesc ?? "";

  if (!isIpAllowed(sourceIp)) {
    await MpesaCallbackLog.create({
      sourceIp,
      checkoutRequestId: checkoutRequestId ?? null,
      resultCode: resultCode ?? null,
      rawPayload: payload,
      processingNote: "Rejected: source IP not in DARAJA_CALLBACK_IP_ALLOWLIST",
    });
    logger.warn({ sourceIp, checkoutRequestId }, "callback from disallowed IP");
    return ack();
  }

  if (!checkoutRequestId) {
    await MpesaCallbackLog.create({
      sourceIp,
      rawPayload: payload ?? {},
      processingNote: "No CheckoutRequestID in payload",
    });
    return ack();
  }

  let mpesaReceiptNumber: string | null = null;
  if (resultCode === 0 && callback.CallbackMetadata?.Item) {
    const items: { Name: string; Value: string | number }[] = callback.CallbackMetadata.Item;
    const receiptItem = items.find((i: any) => i.Name === "MpesaReceiptNumber");
    mpesaReceiptNumber = receiptItem ? String(receiptItem.Value) : null;
  }

  const txn = await Transaction.findOne({ "mpesaDetails.checkoutRequestId": checkoutRequestId });

  if (!txn) {
    await MpesaCallbackLog.create({
      sourceIp,
      checkoutRequestId,
      resultCode: resultCode ?? null,
      rawPayload: payload,
      processingNote: "No matching transaction for CheckoutRequestID",
    });
    logger.warn({ checkoutRequestId }, "callback matched no transaction");
    return ack();
  }

  if (txn.paymentStatus !== "PENDING") {
    await MpesaCallbackLog.create({
      sourceIp,
      checkoutRequestId,
      resultCode: resultCode ?? null,
      matchedTransactionId: txn._id,
      rawPayload: payload,
      processingNote: "Ignored: transaction already " + txn.paymentStatus + " (likely duplicate callback delivery)",
    });
    return ack();
  }

  const newStatus = resultCode === 0 ? "SUCCESS" : "FAILED";
  txn.paymentStatus = newStatus;
  txn.mpesaDetails.resultCode = resultCode ?? null;
  txn.mpesaDetails.resultDesc = resultDesc;
  txn.mpesaDetails.receiptNumber = mpesaReceiptNumber;
  await txn.save();
  emitTransactionEvent("updated", txn);

  await MpesaCallbackLog.create({
    sourceIp,
    checkoutRequestId,
    resultCode: resultCode ?? null,
    matchedTransactionId: txn._id,
    rawPayload: payload,
    processingNote: "Applied: transaction set to " + newStatus,
  });

  logger.info({ txnId: txn._id.toString(), checkoutRequestId, newStatus }, "callback processed");
  ack();
});
