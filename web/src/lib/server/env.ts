import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
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
});

type ServerEnv = z.infer<typeof schema>;
let cached: ServerEnv | null = null;

export function getEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
