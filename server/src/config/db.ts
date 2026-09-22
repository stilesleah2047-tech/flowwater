import mongoose from "mongoose";
import { env } from "@/config/env";
import { logger } from "@/utils/logger";

export async function connectDb(): Promise<typeof mongoose> {
  mongoose.set("strictQuery", true);
  const conn = await mongoose.connect(env.MONGODB_URI);
  logger.info({ host: conn.connection.host, db: conn.connection.name }, "MongoDB connected");

  mongoose.connection.on("error", (err) => {
    logger.error({ err }, "MongoDB connection error");
  });
  mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected");
  });

  return conn;
}
