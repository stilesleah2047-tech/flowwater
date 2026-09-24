import { Schema, model, Types, Document } from "mongoose";

export type PaymentMethod = "CASH" | "MPESA";
export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED";

export interface ITransaction extends Document {
  _id: Types.ObjectId;
  branchId: Types.ObjectId;
  staffId: Types.ObjectId;
  customerName: string | null;
  customerPhone: string;
  productId: Types.ObjectId;
  sizeLiters: number; // snapshotted at sale time
  quantity: number;
  unitPrice: number; // snapshotted at sale time
  amountTotal: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;

  mpesaDetails: {
    checkoutRequestId: string | null;
    merchantRequestId: string | null;
    receiptNumber: string | null;
    resultCode: number | null;
    resultDesc: string | null;
  };

  clientUuid: string; // idempotency key generated on-device
  syncedFromOffline: boolean;

  // TAMPER PREVENTION: this is what the device *claimed* the time was when
  // the sale happened — informational only, e.g. for offline-queue
  // ordering in the UI. It is NEVER used for reconciliation, reporting, or
  // as the authoritative sale time, precisely because a delivery worker
  // could set their phone's clock backward/forward to forge history. The
  // authoritative time is `createdAt`, which Mongoose/MongoDB stamps from
  // the SERVER's clock at insert time and which the API never accepts as
  // client input (see transactions.routes.ts / mpesa.routes.ts — neither
  // route reads a timestamp field off the request body).
  clientSubmittedAt: Date | null;

  createdAt: Date; // authoritative — server clock
  updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    staffId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    customerName: { type: String, default: null, trim: true },
    customerPhone: { type: String, required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    sizeLiters: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    amountTotal: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: ["CASH", "MPESA"], required: true },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED"],
      required: true,
      default: "PENDING",
    },

    mpesaDetails: {
      checkoutRequestId: { type: String, default: null },
      merchantRequestId: { type: String, default: null },
      receiptNumber: { type: String, default: null },
      resultCode: { type: Number, default: null },
      resultDesc: { type: String, default: null },
    },

    clientUuid: { type: String, required: true },
    syncedFromOffline: { type: Boolean, default: false },
    clientSubmittedAt: { type: Date, default: null },
  },
  { timestamps: true } // createdAt/updatedAt set from the server's Date.now(), not client input
);

// Required indexes: branch_id, created_at, mpesa checkout id.
transactionSchema.index({ branchId: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ "mpesaDetails.checkoutRequestId": 1 });
// Idempotency: an offline-queued sale replayed twice must never duplicate.
transactionSchema.index({ clientUuid: 1 }, { unique: true });
// Practical addition: the actual hot query pattern for both the live feed
// and reconciliation is "this branch, most recent first" / "this branch,
// today" — a compound index serves that far better than the two single
// indexes above combined.
transactionSchema.index({ branchId: 1, createdAt: -1 });
transactionSchema.index({ paymentStatus: 1 });

export const Transaction = model<ITransaction>("Transaction", transactionSchema);
