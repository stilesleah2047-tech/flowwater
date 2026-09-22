"use client";

import { Branch } from "@/lib/types";

interface Props {
  branches: Branch[];
  selectedBranchId: string;
  onChange: (id: string) => void;
  isSuperAdmin: boolean;
}

export default function GlobalSwitcher({ branches, selectedBranchId, onChange, isSuperAdmin }: Props) {
  if (!isSuperAdmin) {
    return (
      <div className="flex items-center gap-2 rounded-xl2 bg-white px-4 py-2.5 shadow-soft">
        <span className="h-2 w-2 rounded-full bg-flow-500" />
        <span className="font-display text-sm font-semibold text-depth-900">
          {branches[0]?.branchName ?? "Your branch"}
        </span>
      </div>
    );
  }

  return (
    <select
      aria-label="Global Switcher — filter by branch"
      value={selectedBranchId}
      onChange={(e) => onChange(e.target.value)}
      className="tap-target sticky top-2 z-20 rounded-xl2 border border-depth-200 bg-white px-4 font-display text-sm font-semibold text-depth-900 shadow-soft"
    >
      <option value="ALL">Global — All Branches</option>
      {branches.map((b) => (
        <option key={b._id} value={b._id}>
          {b.branchName} — {b.locationCity}
        </option>
      ))}
    </select>
  );
}
