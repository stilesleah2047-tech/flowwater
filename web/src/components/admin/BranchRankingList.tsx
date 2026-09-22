"use client";

import { DashboardSummary } from "@/lib/types";

interface Props {
  ranking: DashboardSummary["branchRanking"];
}

export default function BranchRankingList({ ranking }: Props) {
  if (ranking.length === 0) {
    return (
      <div className="rounded-xl2 bg-white p-6 text-center text-sm text-depth-500 shadow-soft">
        No branch activity yet today.
      </div>
    );
  }

  const maxRevenue = Math.max(...ranking.map((r) => r.revenue), 1);

  return (
    <div className="rounded-xl2 bg-white shadow-soft">
      <div className="border-b border-depth-100 px-4 py-3">
        <h3 className="font-display font-semibold text-depth-900">Branch performance ranking</h3>
        <p className="text-xs text-depth-500">Revenue today, highest first</p>
      </div>
      <ul className="divide-y divide-depth-100">
        {ranking.map((r, i) => (
          <li key={r.branchId} className="px-4 py-3">
            <div className="mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-depth-100 text-xs font-bold text-depth-700">
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-depth-900">{r.branchName}</span>
                <span className="text-xs text-depth-500">{r.locationCity}</span>
              </div>
              <span className="font-mono text-sm font-semibold text-depth-900">
                KES {r.revenue.toLocaleString()}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-depth-100">
              <div className="h-full rounded-full bg-flow-500" style={{ width: (r.revenue / maxRevenue) * 100 + "%" }} />
            </div>
            <div className="mt-1 flex gap-3 text-xs text-depth-500">
              <span>{r.salesCount} sales</span>
              <span className="text-cash-600">Cash KES {r.cashTotal.toLocaleString()}</span>
              <span className="text-confirm-600">M-Pesa KES {r.mpesaTotal.toLocaleString()}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
