import { Schema, model, Types, Document } from "mongoose";

/**
 * One document per (user, device). This is what makes "persistent sessions
 * that survive poor network coverage" possible — a device holds a
 * long-lived refresh token (30d default) here, and uses it to mint fresh
 * short-lived access tokens (15m) without re-entering a PIN. It is also
 * how device binding is enforced: a DELIVERY account is capped at
 * DELIVERY_MAX_DEVICES active sessions (see auth.routes.ts), counted by
 * distinct `deviceId`, not by token — logging in again on the same device
 * simply rotates that device's row rather than consuming a new slot.
 */
export interface IUserSession extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  deviceId: string; // client-generated UUID, persisted in device storage
  deviceLabel: string | null; // e.g. "Chrome on Android" — for the "active devices" UI
  refreshTokenHash: string; // the raw refresh token is never stored, only its hash
  lastUsedAt: Date;
  expiresAt: Date;
  createdAt: Date;
}

const userSessionSchema = new Schema<IUserSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    deviceId: { type: String, required: true },
    deviceLabel: { type: String, default: null },
    refreshTokenHash: { type: String, required: true },
    lastUsedAt: { type: Date, default: () => new Date() },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

userSessionSchema.index({ userId: 1, deviceId: 1 }, { unique: true });
// TTL index — MongoDB automatically deletes expired sessions, so a stale
// refresh token can never be replayed after its expiry even if somehow
// leaked.
userSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const UserSession = model<IUserSession>("UserSession", userSessionSchema);
