import http from "http";
import { env } from "@/config/env";
import { connectDb } from "@/config/db";
import { createApp } from "@/app";
import { initSockets } from "@/sockets";
import { logger } from "@/utils/logger";

async function main() {
  await connectDb();

  const app = createApp();
  const httpServer = http.createServer(app);

  // Socket.io + the Transaction change stream are attached to the same
  // HTTP server the Express app runs on — this is why this backend runs
  // as a standalone long-lived Node process rather than serverless
  // functions: change streams and websocket connections both need a
  // persistent process, which a per-request serverless invocation can't
  // provide.
  initSockets(httpServer);

  httpServer.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, "AquaFlow API listening");
  });

  process.on("SIGTERM", () => {
    logger.info("SIGTERM received, shutting down");
    httpServer.close(() => process.exit(0));
  });
}

main().catch((err) => {
  logger.error({ err: err?.message, stack: err?.stack }, "fatal startup error");
  process.exit(1);
});
