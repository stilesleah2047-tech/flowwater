"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { useTransactionFeed } from "@/lib/socket";
import { AuthUser, Branch, DashboardSummary, ReconciliationRow, Transaction } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { SkeletonCardGrid, SkeletonTable } from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import GlobalSwitcher from "@/components/admin/GlobalSwitcher";
import FinancialOverviewCards from "@/components/admin/FinancialOverviewCards";
import PaymentSplitBar from "@/components/admin/PaymentSplitBar";
import BranchRankingList from "@/components/admin/BranchRankingList";
import ActivityFeedMatrix from "@/components/admin/ActivityFeedMatrix";
import ReconciliationGrid from "@/components/admin/ReconciliationGrid";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { show } = useToast();
  const [me, setMe] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoaded, setBranchesLoaded] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("ALL");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [reconciliation, setReconciliation] = useState<ReconciliationRow[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const { events: liveEvents, connected } = useTransactionFeed(50);

  useEffect(() => {
    (async () => {
      try {
        const result = await apiFetch<{ user: AuthUser }>("/api/auth/me");
        if (result.user.role === "DELIVERY") {
          router.replace("/terminal");
          return;
        }
        setMe(result.user);
        if (result.user.role !== "SUPER_ADMIN" && result.user.branchId) {
          setSelectedBranchId(result.user.branchId);
        }
      } catch {
        router.replace("/login");
        return;
      }
      setAuthChecked(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    (async () => {
      try {
        const result = await apiFetch<{ branches: Branch[] }>("/api/branches");
        setBranches(result.branches);
      } catch {
        // handled by the empty-branches nudge below on a best-effort basis
      }
      setBranchesLoaded(true);
    })();
  }, [authChecked]);

  useEffect(() => {
    if (!authChecked) return;
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, selectedBranchId]);

  async function loadDashboardData() {
    setLoading(true);
    try {
      const branchParam = selectedBranchId === "ALL" ? "" : "?branchId=" + selectedBranchId;
      const [summaryRes, reconRes, txnRes] = await Promise.all([
        apiFetch<DashboardSummary>("/api/dashboard/summary" + branchParam),
        apiFetch<{ rows: ReconciliationRow[] }>("/api/dashboard/reconciliation" + branchParam),
        apiFetch<{ transactions: Transaction[] }>(
          "/api/transactions" + (branchParam ? branchParam + "&limit=50" : "?limit=50")
        ),
      ]);
      setSummary(summaryRes);
      setReconciliation(reconRes.rows);
      setRecentTransactions(txnRes.transactions);
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Could not load dashboard data", "error");
    }
    setLoading(false);
  }

  const branchNames = useMemo(() => {
    const map: Record<string, string> = {};
    branches.forEach((b) => (map[b._id] = b.branchName));
    return map;
  }, [branches]);

  const feedTransactions = useMemo(() => {
    const merged = new Map<string, Transaction>();
    recentTransactions.forEach((t) => merged.set(t._id, t));
    liveEvents.forEach((t) => merged.set(t._id, t));
    return Array.from(merged.values())
      .filter((t) => {
        if (selectedBranchId === "ALL") return true;
        const bId = typeof t.branchId === "string" ? t.branchId : t.branchId._id;
        return bId === selectedBranchId;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50);
  }, [recentTransactions, liveEvents, selectedBranchId]);

  if (!authChecked || !me) {
    return (
      <main className="min-h-screen bg-sand-50 pb-12">
        <header className="bg-depth-900 px-5 pb-8 pt-8">
          <div className="mx-auto h-14 max-w-6xl" />
        </header>
        <div className="mx-auto -mt-4 max-w-6xl space-y-5 px-5">
          <SkeletonCardGrid count={4} />
          <SkeletonTable rows={4} cols={5} />
        </div>
      </main>
    );
  }

  const scope: "global" | "branch" = selectedBranchId === "ALL" ? "global" : "branch";
  const showNoBranchesNudge = me.role === "SUPER_ADMIN" && branchesLoaded && branches.length === 0;

  return (
    <main className="min-h-screen bg-sand-50 pb-12">
      <header className="bg-depth-900 px-5 pb-8 pt-8 text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-flow-400">AquaFlow</p>
            <h1 className="font-display text-xl font-bold">
              {me.role === "SUPER_ADMIN" ? "Global Control Center" : "Branch Dashboard"}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <GlobalSwitcher
              branches={branches}
              selectedBranchId={selectedBranchId}
              onChange={setSelectedBranchId}
              isSuperAdmin={me.role === "SUPER_ADMIN"}
            />
            {me.role === "SUPER_ADMIN" && (
              <Link href="/admin/branches" className="tap-target flex items-center rounded-xl2 bg-white/10 px-4 text-sm font-medium text-white hover:bg-white/15">
                Branches
              </Link>
            )}
            <Link href="/admin/products" className="tap-target flex items-center rounded-xl2 bg-white/10 px-4 text-sm font-medium text-white hover:bg-white/15">
              Sizes
            </Link>
            <Link href="/admin/staff" className="tap-target flex items-center rounded-xl2 bg-white/10 px-4 text-sm font-medium text-white hover:bg-white/15">
              Staff
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto -mt-4 max-w-6xl space-y-5 px-5">
        {showNoBranchesNudge && (
          <div className="rounded-xl2 bg-white shadow-soft">
            <EmptyState
              icon="👋"
              title="Welcome to AquaFlow"
              description="Nothing to show yet — start by creating your first branch, then add a manager and delivery staff to it."
              action={{ label: "Create your first branch", href: "/admin/branches" }}
            />
          </div>
        )}

        {loading || !summary ? (
          <>
            <SkeletonCardGrid count={4} />
            <SkeletonTable rows={4} cols={5} />
          </>
        ) : (
          <>
            <FinancialOverviewCards
              cashTotal={summary.totals.cashTotal}
              mpesaTotal={summary.totals.mpesaTotal}
              totalSales={summary.totals.totalSales}
              pendingMpesa={summary.totals.pendingMpesa}
            />

            <PaymentSplitBar cashTotal={summary.totals.cashTotal} mpesaTotal={summary.totals.mpesaTotal} />

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
              <div className="space-y-5 lg:col-span-3">
                {scope === "global" && <BranchRankingList ranking={summary.branchRanking} />}
                <ReconciliationGrid rows={reconciliation} showBranchColumn={scope === "global"} />
              </div>
              <div className="lg:col-span-2">
                <ActivityFeedMatrix transactions={feedTransactions} branchNames={branchNames} connected={connected} scope={scope} />
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
