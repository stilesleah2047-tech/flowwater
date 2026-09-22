import { Request, Response, NextFunction } from "express";
import { logger } from "@/utils/logger";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: "Not found" });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  logger.error({ err: err?.message, stack: err?.stack, path: req.path }, "unhandled error");
  if (res.headersSent) return;
  res.status(err?.status ?? 500).json({
    error: err?.publicMessage ?? "Internal server error",
  });
}
