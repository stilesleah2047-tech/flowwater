import pino from "pino";
import { env } from "@/config/env";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  redact: {
    paths: ["*.password", "*.pin", "*.pin_hash", "req.headers.authorization", "req.headers.cookie"],
    censor: "[redacted]",
  },
  base: { service: "aquaflow-api" },
});
