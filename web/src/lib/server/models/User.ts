import { Schema, model, Types, Document } from "mongoose";
import bcrypt from "bcryptjs";

export type UserRole = "DELIVERY" | "BRANCH_MANAGER" | "SUPER_ADMIN";
export const USER_ROLES: UserRole[] = ["DELIVERY", "BRANCH_MANAGER", "SUPER_ADMIN"];

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  role: UserRole;
  branchId: Types.ObjectId | null; // null only valid for SUPER_ADMIN
  phoneNumber: string; // E.164-ish normalized Kenyan format — kept for contact/M-Pesa reference, not used for login
  email: string; // login identifier for every role, via the single /login page
  passwordHash: string;
  isActive: boolean;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;

  comparePassword(password: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: USER_ROLES, required: true, default: "DELIVERY" },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", default: null },
    phoneNumber: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    isActive: { type: Boolean, default: true },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

// Enforce role/branch invariants at the model layer — belt-and-braces
// alongside API-level validation. Every role authenticates the same way
// now (email + password on the single /login page), so there is no
// per-role credential branching left here — just the branch scoping rule.
userSchema.pre("validate", function (next) {
  if (this.role !== "SUPER_ADMIN" && !this.branchId) {
    return next(new Error("branchId is required for all roles except SUPER_ADMIN"));
  }
  if (this.role === "SUPER_ADMIN" && this.branchId) {
    return next(new Error("SUPER_ADMIN accounts must not be scoped to a single branchId"));
  }
  next();
});

userSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  if (!this.passwordHash) return false;
  return bcrypt.compare(password, this.passwordHash);
};

export const User = model<IUser>("User", userSchema);
