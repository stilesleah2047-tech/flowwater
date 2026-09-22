import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGINS: z.string().min(1),

  MONGODB_URI: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),
  DELIVERY_MAX_DEVICES: z.coerce.number().default(2),

  DARAJA_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
  DARAJA_CONSUMER_KEY: z.string().min(1),
  DARAJA_CONSUMER_SECRET: z.string().min(1),
  DARAJA_SHORTCODE: z.string().min(1),
  DARAJA_PASSKEY: z.string().min(1),
  DARAJA_TRANSACTION_TYPE: z
    .enum(["CustomerPayBillOnline", "CustomerBuyGoodsOnline"])
    .default("CustomerPayBillOnline"),
  DARAJA_CALLBACK_URL: z.string().url(),
  DARAJA_CALLBACK_IP_ALLOWLIST: z.string().optional(),

  SEED_SUPER_ADMIN_EMAIL: z.string().email().optional(),
  SEED_SUPER_ADMIN_PASSWORD: z.string().min(8).optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  // Fail fast at boot rather than mid-request.
  // eslint-disable-next-line no-console
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

export const env = parsed.data;

if (env.NODE_ENV === "production" && env.DARAJA_ENV === "sandbox") {
  // eslint-disable-next-line no-console
  console.warn(
    "[env] WARNING: NODE_ENV=production but DARAJA_ENV=sandbox — M-Pesa payments will hit Safaricom's sandbox."
  );
}
