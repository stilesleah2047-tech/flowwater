"use client";

import { ReconciliationRow } from "@/lib/types";

interface Props {
  rows: ReconciliationRow[];
  showBranchColumn: boolean;
}

function VarianceBadge({ row }: { row: ReconciliationRow }) {
  if (row.eveningPhysicalCount == null) {
    return (
      <span className="rounded-full bg-depth-100 px-2.5 py-1 text-xs font-medium text-depth-600">
        Awaiting count
      </span>
    );
  }
  if (row.reconciledOk) {
    return (
      <span className="rounded-full bg-confirm-500/15 px-2.5 py-1 text-xs font-medium text-confirm-600">
        ✓ Reconciled
      </span>
    );
  }
  const diff = row.eveningPhysicalCount - row.expectedRemaining;
  return (
    <span className="flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
      ⚠ {diff > 0 ? "+" + diff + " surplus" : diff + " SHORT"}
    </span>
  );
}

export default function ReconciliationGrid({ rows, showBranchColumn }: Props) {
  const hasVariance = rows.some((r) => r.eveningPhysicalCount != null && !r.reconciledOk);

  return (
    <div className="rounded-xl2 bg-white shadow-soft">
      <div className="flex items-center justify-between border-b border-depth-100 px-4 py-3">
        <div>
          <h3 className="font-display font-semibold text-depth-900">Automated reconciliation</h3>
          <p className="text-xs text-depth-500">Dispatched − sold = expected, vs. physical evening count</p>
        </div>
        {hasVariance && (
          <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">Variance detected</span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-depth-100 text-left text-xs uppercase tracking-wide text-depth-500">
              {showBranchColumn && <th className="px-4 py-2.5">Branch</th>}
              <th className="px-4 py-2.5">Size</th>
              <th className="px-4 py-2.5 text-right">Dispatched</th>
              <th className="px-4 py-2.5 text-right">Sold</th>
              <th className="px-4 py-2.5 text-right">Expected</th>
              <th className="px-4 py-2.5 text-right">Physical</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-depth-100">
            {rows.map((r) => {
              const flagged = r.eveningPhysicalCount != null && !r.reconciledOk;
              return (
                <tr key={r.branchId + "-" + r.productId} className={flagged ? "bg-red-50" : undefined}>
                  {showBranchColumn && <td className="px-4 py-3 font-medium text-depth-900">{r.branchName}</td>}
                  <td className="px-4 py-3 font-medium text-depth-900">{r.sizeLiters}L</td>
                  <td className="px-4 py-3 text-right font-mono">{r.morningDispatched}</td>
                  <td className="px-4 py-3 text-right font-mono">{r.totalSold}</td>
                  <td className="px-4 py-3 text-right font-mono">{r.expectedRemaining}</td>
                  <td className="px-4 py-3 text-right font-mono">{r.eveningPhysicalCount ?? "—"}</td>
                  <td className="px-4 py-3">
                    <VarianceBadge row={r} />
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={showBranchColumn ? 7 : 6} className="px-4 py-8 text-center text-depth-500">
                  No stock data for the selected filter. Enter this morning&apos;s dispatched counts to begin tracking.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
