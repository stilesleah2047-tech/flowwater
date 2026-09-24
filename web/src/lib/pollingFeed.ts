"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Transaction } from "@/lib/types";

export function useTransactionFeed(branchId: string, maxItems = 50, intervalMs = 4000) {
  const [events, setEvents] = useState<Transaction[]>([]);
  const [connected, setConnected] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const branchParam = branchId === "ALL" ? "" : "?branchId=" + branchId;
        const result = await apiFetch<{ transactions: Transaction[] }>(
          "/api/transactions" + (branchParam ? branchParam + "&limit=" + maxItems : "?limit=" + maxItems)
        );
        if (!cancelled) {
          setEvents(result.transactions);
          setConnected(true);
        }
      } catch {
        if (!cancelled) setConnected(false);
      }
    }

    poll();
    timerRef.current = setInterval(poll, intervalMs);

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, intervalMs]);

  return { events, connected };
}
