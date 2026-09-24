import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/server/db";
import { Transaction } from "@/lib/server/models/Transaction";
import { MpesaCallbackLog } from "@/lib/server/models/MpesaCallbackLog";

export const runtime = "nodejs";

function getSourceIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "unknown";
}

function isIpAllowed(ip: string): boolean {
  const allowlist = process.env.DARAJA_CALLBACK_IP_ALLOWLIST;
  if (!allowlist) return true;
  return allowlist.split(",").map((s) => s.trim()).includes(ip);
}

export async function POST(req: NextRequest) {
  await connectDb();
  const ack = () => NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  const sourceIp = getSourceIp(req);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    await MpesaCallbackLog.create({
      sourceIp,
      rawPayload: { unparsable: true },
      processingNote: "Malformed JSON body",
    });
    return ack();
  }

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
    return ack();
  }

  if (txn.paymentStatus !== "PENDING") {
    await MpesaCallbackLog.create({
      sourceIp,
      checkoutRequestId,
      resultCode: resultCode ?? null,
      matchedTransactionId: txn._id,
      rawPayload: payload,
      processingNote: "Ignored: transaction already " + txn.paymentStatus,
    });
    return ack();
  }

  const newStatus = resultCode === 0 ? "SUCCESS" : "FAILED";
  txn.paymentStatus = newStatus;
  txn.mpesaDetails.resultCode = resultCode ?? null;
  txn.mpesaDetails.resultDesc = resultDesc;
  txn.mpesaDetails.receiptNumber = mpesaReceiptNumber;
  await txn.save();

  await MpesaCallbackLog.create({
    sourceIp,
    checkoutRequestId,
    resultCode: resultCode ?? null,
    matchedTransactionId: txn._id,
    rawPayload: payload,
    processingNote: "Applied: transaction set to " + newStatus,
  });

  return ack();
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
