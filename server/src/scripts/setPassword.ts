import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDb } from "@/config/db";
import { User } from "@/models/User";
import { logger } from "@/utils/logger";

// Usage: npx tsx src/scripts/setPassword.ts <email> <newPassword>
async function run() {
  const [, , email, newPassword] = process.argv;

  if (!email || !newPassword) {
    console.error("Usage: npx tsx src/scripts/setPassword.ts <email> <newPassword>");
    process.exit(1);
  }
  if (newPassword.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  await connectDb();

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    logger.error({ email }, "No user found with that email");
    await mongoose.disconnect();
    process.exit(1);
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  await user.save();

  logger.info({ email }, "Password updated successfully");
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});