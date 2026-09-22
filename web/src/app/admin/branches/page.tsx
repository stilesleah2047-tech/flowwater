"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { AuthUser, Branch } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";

export default function BranchesPage() {
  const router = useRouter();
  const { show } = useToast();
  const [me, setMe] = useState<AuthUser | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [branchName, setBranchName] = useState("");
  const [locationCity, setLocationCity] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const result = await apiFetch<{ user: AuthUser }>("/api/auth/me");
        if (result.user.role === "DELIVERY") {
          router.replace("/terminal");
          return;
        }
        if (result.user.role !== "SUPER_ADMIN") {
          router.replace("/admin/dashboard");
          return;
        }
        setMe(result.user);
      } catch {
        router.replace("/login");
        return;
      }
      await loadBranches();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadBranches() {
    const result = await apiFetch<{ branches: Branch[] }>("/api/branches");
    setBranches(result.branches);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!branchName.trim() || !locationCity.trim()) {
      setError("Enter both a branch name and a city.");
      return;
    }

    setSaving(true);
    try {
      await apiFetch("/api/branches", {
        method: "POST",
        body: JSON.stringify({ branchName: branchName.trim(), locationCity: locationCity.trim() }),
      });
      show(branchName.trim() + " created", "success");
      setBranchName("");
      setLocationCity("");
      await loadBranches();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not create branch";
      setError(message);
      show(message, "error");
    }
    setSaving(false);
  }

  if (!me) {
    return (
      <main className="min-h-screen bg-sand-50 pb-12">
        <header className="bg-depth-900 px-5 pb-8 pt-8">
          <div className="mx-auto h-14 max-w-3xl" />
        </header>
        <div className="mx-auto -mt-4 max-w-3xl px-5">
          <SkeletonList rows={3} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-sand-50 pb-12">
      <header className="bg-depth-900 px-5 pb-8 pt-8 text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-flow-400">AquaFlow</p>
            <h1 className="font-display text-xl font-bold">Branches</h1>
          </div>
          <Link
            href="/admin/dashboard"
            className="tap-target flex items-center rounded-xl2 bg-white/10 px-4 text-sm font-medium text-white hover:bg-white/15"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto -mt-4 max-w-3xl space-y-5 px-5">
        {error && (
          <div className="rounded-xl2 border border-alert-500/30 bg-alert-500/10 px-4 py-3 text-sm text-alert-600">
            {error}
          </div>
        )}

        {loading ? (
          <SkeletonList rows={3} />
        ) : (
          <div className="rounded-xl2 bg-white shadow-soft">
            <div className="border-b border-depth-100 px-4 py-3">
              <h2 className="font-display font-semibold text-depth-900">All branches</h2>
              <p className="text-xs text-depth-500">
                Create a branch here first, then head to{" "}
                <Link href="/admin/staff" className="underline underline-offset-2">
                  Staff
                </Link>{" "}
                to assign it a Branch Manager. That manager can then add their own delivery staff —
                you won&apos;t need to touch this page again for day-to-day hiring.
              </p>
            </div>

            {branches.length === 0 ? (
              <EmptyState
                icon="🏢"
                title="No branches yet"
                description="Every staff account needs a branch to belong to. Create your first one using the form below."
                action={{ label: "Jump to the form", onClick: () => document.getElementById("branch-name")?.focus() }}
              />
            ) : (
              <ul className="divide-y divide-depth-100">
                {branches.map((b) => (
                  <li key={b._id} className="flex items-center justify-between px-4 py-3 animate-fade-up">
                    <div>
                      <p className="font-medium text-depth-900">{b.branchName}</p>
                      <p className="text-xs text-depth-500">{b.locationCity}</p>
                    </div>
                    <span
                      className={
                        "rounded-full px-2.5 py-1 text-xs font-medium " +
                        (b.managerId ? "bg-confirm-500/15 text-confirm-600" : "bg-cash-500/15 text-cash-600")
                      }
                    >
                      {b.managerId ? "Has manager" : "No manager yet"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <form onSubmit={handleCreate} className="rounded-xl2 bg-white p-4 shadow-soft">
          <h2 className="mb-3 font-display font-semibold text-depth-900">Add a new branch</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-depth-600" htmlFor="branch-name">
                Branch name
              </label>
              <input
                id="branch-name"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="e.g. CBD Hub"
                className="tap-target w-full rounded-xl border border-depth-200 px-3"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-depth-600" htmlFor="city">
                City
              </label>
              <input
                id="city"
                value={locationCity}
                onChange={(e) => setLocationCity(e.target.value)}
                placeholder="e.g. Nairobi"
                className="tap-target w-full rounded-xl border border-depth-200 px-3"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="tap-target mt-4 w-full rounded-xl2 bg-flow-500 font-display font-semibold text-depth-950 disabled:opacity-60 sm:w-auto sm:px-8"
          >
            {saving ? "Creating…" : "Create branch"}
          </button>
        </form>
      </div>
    </main>
  );
}
