import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/server/db";
import { Transaction } from "@/lib/server/models/Transaction";
import { getAuth } from "@/lib/server/auth";
import { queryStkStatus } from "@/lib/server/mpesa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { transactionId: string } }) {
  await connectDb();
  const auth = getAuth(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const txn = await Transaction.findById(params.transactionId);
  if (!txn) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

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
          return NextResponse.json(fresh);
        }
      }
    } catch {
      // Daraja query failed/still pending — fall through and return current row.
    }
  }

  return NextResponse.json(txn);
}
