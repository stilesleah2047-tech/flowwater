import { Schema, model, Types, Document } from "mongoose";

export interface IBranch extends Document {
  _id: Types.ObjectId;
  branchName: string;
  locationCity: string;
  managerId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const branchSchema = new Schema<IBranch>(
  {
    branchName: { type: String, required: true, trim: true },
    locationCity: { type: String, required: true, trim: true },
    managerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export const Branch = model<IBranch>("Branch", branchSchema);
