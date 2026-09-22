import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "@/config/env";
import { generalApiLimiter } from "@/middleware/rateLimit";
import { errorHandler, notFoundHandler } from "@/middleware/errorHandler";
import { authRouter } from "@/routes/auth.routes";
import { transactionsRouter } from "@/routes/transactions.routes";
import { mpesaRouter } from "@/routes/mpesa.routes";
import { productsRouter } from "@/routes/products.routes";
import { branchesRouter } from "@/routes/branches.routes";
import { inventoryRouter } from "@/routes/inventory.routes";
import { dashboardRouter } from "@/routes/dashboard.routes";
import { usersRouter } from "@/routes/users.routes";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
    })
  );

  const allowedOrigins = env.CORS_ORIGINS.split(",").map((s) => s.trim());
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    })
  );

  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use(generalApiLimiter);

  app.get("/api/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

  app.use("/api/auth", authRouter);
  app.use("/api/transactions", transactionsRouter);
  app.use("/api/mpesa", mpesaRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/branches", branchesRouter);
  app.use("/api/inventory", inventoryRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/users", usersRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
