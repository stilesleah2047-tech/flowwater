import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import { Transaction } from "@/models/Transaction";
import { verifyAccessToken } from "@/utils/jwt";
import { logger } from "@/utils/logger";
import { env } from "@/config/env";

let io: SocketIOServer | null = null;

/**
 * Rooms: every connected client joins `branch:<id>` for their own branch.
 * SUPER_ADMIN additionally joins `global`, which receives every branch's
 * events — this is what powers the Global Switcher's "All Branches" view
 * without the server fanning out branch-scoped duplicates to admins who
 * don't need them (a BRANCH_MANAGER only ever gets their own room).
 */
export function initSockets(httpServer: HttpServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGINS.split(",").map((s) => s.trim()),
      credentials: true,
    },
  });

  io.use((socket: Socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        parseCookie(socket.handshake.headers.cookie ?? "", "access_token");
      if (!token) return next(new Error("Not authenticated"));
      const payload = verifyAccessToken(token);
      (socket as any).auth = payload;
      next();
    } catch {
      next(new Error("Not authenticated"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const auth = (socket as any).auth;
    if (auth.role === "SUPER_ADMIN") {
      socket.join("global");
    }
    if (auth.branchId) {
      socket.join("branch:" + auth.branchId);
    }
    logger.debug({ userId: auth.sub, role: auth.role }, "socket connected");
  });

  // MongoDB Change Streams — requires the underlying MongoDB deployment to
  // be a replica set (Atlas clusters are, by default; a standalone local
  // mongod is NOT — see server/.env.example). This watches the
  // transactions collection directly at the database level, so ANY write
  // (from this API, a script, a future service) reaches connected admin
  // dashboards in real time, not just writes that happen to go through a
  // particular code path that remembers to call emitTransactionEvent.
  const changeStream = Transaction.watch([], { fullDocument: "updateLookup" });
  changeStream.on("change", (change: any) => {
    const doc = change.fullDocument;
    if (!doc) return;
    const eventType = change.operationType === "insert" ? "created" : "updated";
    broadcast(eventType, doc);
  });
  changeStream.on("error", (err: any) => {
    logger.error(
      { err: err?.message },
      "Transaction change stream error — confirm MongoDB is a replica set (see .env.example)"
    );
  });

  logger.info("Socket.io + Transaction change stream initialized");
  return io;
}

function parseCookie(cookieHeader: string, name: string): string | null {
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(name + "="));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

function broadcast(eventType: "created" | "updated", doc: any) {
  if (!io) return;
  const payload = {
    _id: doc._id,
    branchId: doc.branchId,
    staffId: doc.staffId,
    customerName: doc.customerName,
    customerPhone: doc.customerPhone,
    sizeLiters: doc.sizeLiters,
    quantity: doc.quantity,
    amountTotal: doc.amountTotal,
    paymentMethod: doc.paymentMethod,
    paymentStatus: doc.paymentStatus,
    createdAt: doc.createdAt,
  };
  io.to("global").emit("transaction:" + eventType, payload);
  io.to("branch:" + doc.branchId).emit("transaction:" + eventType, payload);
}

/**
 * Also called directly, in-process, right after a write (see
 * mpesa.routes.ts) — belt-and-braces alongside the Change Stream. The
 * Change Stream is the durable, comprehensive source of real-time truth;
 * this direct emit just shaves the small latency window between a write
 * completing and the stream picking it up, for the specific case of the
 * worker who made the sale watching their own screen update.
 */
export function emitTransactionEvent(eventType: "created" | "updated", doc: any) {
  broadcast(eventType, doc);
}

export function getIo(): SocketIOServer | null {
  return io;
}
