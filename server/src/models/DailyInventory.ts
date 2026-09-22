import { Schema, model, Types, Document } from "mongoose";

export interface IDailyInventory extends Document {
  _id: Types.ObjectId;
  branchId: Types.ObjectId;
  productId: Types.ObjectId;
  date: string; // YYYY-MM-DD, branch-local calendar day — see note below
  morningDispatched: number;
  eveningPhysicalCount: number | null;
  recordedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * One document per branch, per product (size), per day — a 5L and a 20L
 * are physically different stock and must reconcile independently.
 * `date` is stored as a plain YYYY-MM-DD string rather than a Date so
 * "today" comparisons are unambiguous and don't depend on server timezone
 * math; the app writes it using the branch's local calendar day.
 */
const dailyInventorySchema = new Schema<IDailyInventory>(
  {
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    date: { type: String, required: true },
    morningDispatched: { type: Number, default: 0, min: 0 },
    eveningPhysicalCount: { type: Number, default: null, min: 0 },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

// Required compound index: {branch_id: 1, date: 1} — this is the exact
// access pattern for both "today's dispatch entry for this branch" writes
// and the reconciliation aggregation's $match stage.
dailyInventorySchema.index({ branchId: 1, date: 1 });
// One ledger row per branch+product+day.
dailyInventorySchema.index({ branchId: 1, productId: 1, date: 1 }, { unique: true });

export const DailyInventory = model<IDailyInventory>("DailyInventory", dailyInventorySchema);
