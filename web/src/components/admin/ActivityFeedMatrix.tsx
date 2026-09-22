"use client";

import { Transaction } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import EmptyState from "@/components/ui/EmptyState";

interface Props {
  transactions: Transaction[];
  branchNames: Record<string, string>;
  connected: boolean;
  scope: "global" | "branch";
}

const statusStyles: Record<string, string> = {
  SUCCESS: "bg-confirm-500/15 text-confirm-600",
  PENDING: "bg-cash-500/15 text-cash-600",
  FAILED: "bg-alert-500/15 text-alert-600",
};

export default function ActivityFeedMatrix({ transactions, branchNames, connected, scope }: Props) {
  return (
    <div className="rounded-xl2 bg-white shadow-soft">
      <div className="flex items-center justify-between border-b border-depth-100 px-4 py-3">
        <h3 className="font-display font-semibold text-depth-900">Live activity feed</h3>
        <span className={"flex items-center gap-1.5 text-xs " + (connected ? "text-confirm-600" : "text-alert-600")}>
          <span className={"h-1.5 w-1.5 rounded-full " + (connected ? "animate-pulse bg-confirm-500" : "bg-alert-500")} />
          {connected ? "Live" : "Reconnecting…"}
        </span>
      </div>

      <ul className="max-h-[32rem] divide-y divide-depth-100 overflow-y-auto">
        {transactions.length === 0 && (
          <li>
            <EmptyState
              icon="📡"
              title="No sales yet"
              description="As soon as a delivery worker records a sale anywhere in your network, it'll appear here in real time."
            />
          </li>
        )}
        {transactions.map((t) => {
          const branchId = typeof t.branchId === "string" ? t.branchId : t.branchId._id;
          const branchLabel = typeof t.branchId === "object" ? t.branchId.branchName : branchNames[branchId] ?? "—";
          return (
            <li key={t._id} className="flex items-center justify-between gap-3 px-4 py-3 animate-fade-up">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-depth-900">{t.customerName || t.customerPhone}</p>
                  {scope === "global" && (
                    <span className="whitespace-nowrap rounded-full bg-depth-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-depth-600">
                      {branchLabel}
                    </span>
                  )}
                </div>
                <p className="text-xs text-depth-500">
                  {t.quantity} × {t.sizeLiters}L · {t.paymentMethod === "CASH" ? "Cash" : "M-Pesa"} ·{" "}
                  {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
                </p>
              </div>
              <div className="flex flex-shrink-0 flex-col items-end gap-1">
                <span className="font-mono text-sm font-semibold text-depth-900">KES {t.amountTotal.toLocaleString()}</span>
                <span className={"rounded-full px-2 py-0.5 text-[11px] font-medium " + statusStyles[t.paymentStatus]}>
                  {t.paymentStatus}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
