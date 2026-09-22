import { openDB, DBSchema, IDBPDatabase } from "idb";
import { apiFetch } from "@/lib/api";

export interface QueuedCashSale {
  clientUuid: string;
  customerName?: string;
  customerPhone: string;
  productId: string;
  quantity: number;
  clientSubmittedAt: string;
  synced: boolean;
}

interface QueueDB extends DBSchema {
  cash_sales: { key: string; value: QueuedCashSale };
}

const DB_NAME = "aquaflow-offline";
const STORE = "cash_sales";
let dbPromise: Promise<IDBPDatabase<QueueDB>> | null = null;

function getDb() {
  if (typeof window === "undefined") throw new Error("offlineQueue can only run in the browser");
  if (!dbPromise) {
    dbPromise = openDB<QueueDB>(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE, { keyPath: "clientUuid" });
      },
    });
  }
  return dbPromise;
}

export function generateClientUuid(): string {
  return crypto.randomUUID();
}

export async function queueCashSale(sale: Omit<QueuedCashSale, "synced">): Promise<void> {
  const db = await getDb();
  await db.put(STORE, { ...sale, synced: false });
}

export async function getPendingSales(): Promise<QueuedCashSale[]> {
  const db = await getDb();
  const all = await db.getAll(STORE);
  return all.filter((s) => !s.synced);
}

async function markSynced(clientUuids: string[]) {
  const db = await getDb();
  const tx = db.transaction(STORE, "readwrite");
  for (const id of clientUuids) {
    const row = await tx.store.get(id);
    if (row) {
      row.synced = true;
      await tx.store.put(row);
    }
  }
  await tx.done;
}

export async function flushQueue(): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingSales();
  if (pending.length === 0) return { synced: 0, failed: 0 };

  try {
    const result = await apiFetch<{ inserted: { clientUuid: string }[] }>("/api/transactions/cash", {
      method: "POST",
      body: JSON.stringify({ sales: pending.map((p) => ({ ...p, synced: undefined })) }),
    });
    const syncedIds = result.inserted.map((r) => r.clientUuid);
    await markSynced(syncedIds);
    return { synced: syncedIds.length, failed: pending.length - syncedIds.length };
  } catch {
    return { synced: 0, failed: pending.length };
  }
}

export function registerOfflineSync(onFlush?: (r: { synced: number; failed: number }) => void) {
  if (typeof window === "undefined") return () => {};

  const handler = async () => {
    const result = await flushQueue();
    onFlush?.(result);
  };

  window.addEventListener("online", handler);
  if (navigator.onLine) handler();

  const interval = setInterval(() => {
    if (navigator.onLine) handler();
  }, 30000);

  return () => {
    window.removeEventListener("online", handler);
    clearInterval(interval);
  };
}
