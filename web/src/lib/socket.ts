"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { apiUrl } from "@/lib/api";
import { Transaction } from "@/lib/types";

/**
 * Connects to the Socket.io server on mount, listens for
 * transaction:created / transaction:updated, and keeps a rolling list of
 * recent events for the live activity feed. Auth is via the same httpOnly
 * access_token cookie the REST calls use (the server reads the cookie
 * during the handshake), so no token handling is needed here beyond
 * ensuring cookies are sent.
 */
export function useTransactionFeed(maxItems = 50) {
  const [events, setEvents] = useState<Transaction[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(apiUrl(), {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    const upsert = (txn: Transaction) => {
      setEvents((prev) => {
        const withoutOld = prev.filter((e) => e._id !== txn._id);
        return [txn, ...withoutOld].slice(0, maxItems);
      });
    };

    socket.on("transaction:created", upsert);
    socket.on("transaction:updated", upsert);

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { events, connected };
}
