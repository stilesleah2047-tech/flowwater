import bcrypt from "bcryptjs";
import { connectDb } from "@/config/db";
import { env } from "@/config/env";
import { User } from "@/models/User";
import { Product } from "@/models/Product";
import { logger } from "@/utils/logger";
import mongoose from "mongoose";

/**
 * Run once against a fresh database: `npm run seed`.
 * Creates the first SUPER_ADMIN (email/password, from env) so there's a
 * way into the single /login page at all, and seeds a default jerrycan
 * size catalog. Safe to re-run — it's idempotent (skips if already
 * present).
 */
async function seed() {
  await connectDb();

  if (!env.SEED_SUPER_ADMIN_EMAIL || !env.SEED_SUPER_ADMIN_PASSWORD) {
    logger.error("SEED_SUPER_ADMIN_EMAIL / SEED_SUPER_ADMIN_PASSWORD not set — nothing to seed for auth.");
  } else {
    const existing = await User.findOne({ email: env.SEED_SUPER_ADMIN_EMAIL });
    if (existing) {
      logger.info({ email: env.SEED_SUPER_ADMIN_EMAIL }, "Super admin already exists, skipping");
    } else {
      const passwordHash = await bcrypt.hash(env.SEED_SUPER_ADMIN_PASSWORD, 12);
      await User.create({
        name: "Super Admin",
        role: "SUPER_ADMIN",
        branchId: null,
        phoneNumber: "254700000000", // placeholder — update via admin UI after first login
        email: env.SEED_SUPER_ADMIN_EMAIL,
        passwordHash,
      });
      logger.info({ email: env.SEED_SUPER_ADMIN_EMAIL }, "Super admin created — change the password after first login");
    }
  }

  const existingProducts = await Product.countDocuments();
  if (existingProducts === 0) {
    await Product.insertMany([
      { label: "5L Jerrycan", sizeLiters: 5, unitPrice: 60, sortOrder: 1 },
      { label: "10L Jerrycan", sizeLiters: 10, unitPrice: 110, sortOrder: 2 },
      { label: "20L Jerrycan", sizeLiters: 20, unitPrice: 200, sortOrder: 3 },
    ]);
    logger.info("Seeded default product catalog (5L / 10L / 20L)");
  } else {
    logger.info("Products already exist, skipping catalog seed");
  }

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  logger.error({ err: err?.message }, "seed failed");
  process.exit(1);
});
