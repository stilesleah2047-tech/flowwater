import { Schema, model, Types, Document } from "mongoose";

export interface IMpesaCallbackLog extends Document {
  _id: Types.ObjectId;
  sourceIp: string;
  checkoutRequestId: string | null;
  resultCode: number | null;
  matchedTransactionId: Types.ObjectId | null;
  rawPayload: unknown;
  processingNote: string;
  receivedAt: Date;
}

const mpesaCallbackLogSchema = new Schema<IMpesaCallbackLog>(
  {
    sourceIp: { type: String, required: true },
    checkoutRequestId: { type: String, default: null, index: true },
    resultCode: { type: Number, default: null },
    matchedTransactionId: { type: Schema.Types.ObjectId, ref: "Transaction", default: null },
    rawPayload: { type: Schema.Types.Mixed, required: true },
    processingNote: { type: String, required: true },
    receivedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false }
);

mpesaCallbackLogSchema.index({ receivedAt: -1 });

export const MpesaCallbackLog = model<IMpesaCallbackLog>("MpesaCallbackLog", mpesaCallbackLogSchema);
