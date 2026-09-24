import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDb } from "../src/lib/server/db";
import { User } from "../src/lib/server/models/User";
import { Product } from "../src/lib/server/models/Product";

/**
 * Run once against a fresh database: `npm run seed`.
 * Creates the first SUPER_ADMIN (email/password, from env) so there's a
 * way into the single /login page at all, and seeds a default jerrycan
 * size catalog. Safe to re-run — it's idempotent (skips if already
 * present).
 */
async function seed() {
  await connectDb();

  const email = process.env.SEED_SUPER_ADMIN_EMAIL;
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("SEED_SUPER_ADMIN_EMAIL / SEED_SUPER_ADMIN_PASSWORD not set — nothing to seed for auth.");
  } else {
    const existing = await User.findOne({ email });
    if (existing) {
      console.log(`Super admin (${email}) already exists, skipping`);
    } else {
      const passwordHash = await bcrypt.hash(password, 12);
      await User.create({
        name: "Super Admin",
        role: "SUPER_ADMIN",
        branchId: null,
        phoneNumber: "254700000000",
        email,
        passwordHash,
      });
      console.log(`Super admin created (${email}) — change the password after first login`);
    }
  }

  const existingProducts = await Product.countDocuments();
  if (existingProducts === 0) {
    await Product.insertMany([
      { label: "5L Jerrycan", sizeLiters: 5, unitPrice: 60, sortOrder: 1 },
      { label: "10L Jerrycan", sizeLiters: 10, unitPrice: 110, sortOrder: 2 },
      { label: "20L Jerrycan", sizeLiters: 20, unitPrice: 200, sortOrder: 3 },
    ]);
    console.log("Seeded default product catalog (5L / 10L / 20L)");
  } else {
    console.log("Products already exist, skipping catalog seed");
  }

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("seed failed:", err.message);
  process.exit(1);
});
