"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { AuthUser, Product } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmButton from "@/components/ui/ConfirmButton";

export default function ProductsPage() {
  const router = useRouter();
  const { show } = useToast();
  const [me, setMe] = useState<AuthUser | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [label, setLabel] = useState("");
  const [sizeLiters, setSizeLiters] = useState("");
  const [unitPrice, setUnitPrice] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const result = await apiFetch<{ user: AuthUser }>("/api/auth/me");
        if (result.user.role === "DELIVERY") {
          router.replace("/terminal");
          return;
        }
        setMe(result.user);
      } catch {
        router.replace("/login");
        return;
      }
      await loadProducts();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProducts() {
    const result = await apiFetch<{ products: Product[] }>("/api/products");
    setProducts(result.products);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const size = parseFloat(sizeLiters);
    const price = parseFloat(unitPrice);
    if (!label.trim() || !Number.isFinite(size) || size <= 0 || !Number.isFinite(price) || price < 0) {
      setError("Enter a valid label, size, and price.");
      return;
    }

    setSaving(true);
    try {
      await apiFetch("/api/products", {
        method: "POST",
        body: JSON.stringify({ label: label.trim(), sizeLiters: size, unitPrice: price, sortOrder: products.length }),
      });
      show(label.trim() + " added to the catalog", "success");
      setLabel("");
      setSizeLiters("");
      setUnitPrice("");
      await loadProducts();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not add product";
      setError(message);
      show(message, "error");
    }
    setSaving(false);
  }

  async function handlePriceUpdate(id: string) {
    const price = parseFloat(editPrice);
    if (!Number.isFinite(price) || price < 0) {
      setError("Enter a valid price.");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/products/" + id, { method: "PATCH", body: JSON.stringify({ unitPrice: price }) });
      show("Price updated", "success");
      setEditingId(null);
      await loadProducts();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not update price";
      setError(message);
      show(message, "error");
    }
    setSaving(false);
  }

  async function handleToggleActive(product: Product) {
    try {
      await apiFetch("/api/products/" + product._id, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !product.isActive }),
      });
      show(product.label + (product.isActive ? " deactivated" : " reactivated"), "success");
      await loadProducts();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not update product";
      show(message, "error");
    }
  }

  if (loading || !me) {
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
            <h1 className="font-display text-xl font-bold">Jerrycan sizes &amp; pricing</h1>
          </div>
          <Link href="/admin/dashboard" className="tap-target flex items-center rounded-xl2 bg-white/10 px-4 text-sm font-medium text-white hover:bg-white/15">
            ← Dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto -mt-4 max-w-3xl space-y-5 px-5">
        {error && (
          <div className="rounded-xl2 border border-alert-500/30 bg-alert-500/10 px-4 py-3 text-sm text-alert-600">{error}</div>
        )}

        <div className="rounded-xl2 bg-white shadow-soft">
          <div className="border-b border-depth-100 px-4 py-3">
            <h2 className="font-display font-semibold text-depth-900">Catalog</h2>
            <p className="text-xs text-depth-500">
              Sizes shown here appear as options on every branch&apos;s terminal. Deactivating a size hides
              it from new sales without touching past transactions.
            </p>
          </div>

          {products.length === 0 ? (
            <EmptyState
              icon="🧴"
              title="No jerrycan sizes yet"
              description="Add at least one size below (e.g. 20L) before staff can record any sales."
              action={{ label: "Jump to the form", onClick: () => document.getElementById("label")?.focus() }}
            />
          ) : (
            <ul className="divide-y divide-depth-100">
              {products.map((p) => (
                <li key={p._id} className="flex items-center justify-between gap-3 px-4 py-3 animate-fade-up">
                  <div>
                    <p className="font-medium text-depth-900">
                      {p.label} <span className="text-depth-500">· {p.sizeLiters}L</span>
                    </p>
                    {editingId === p._id ? (
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-sm text-depth-500">KES</span>
                        <input
                          autoFocus
                          type="number"
                          min="0"
                          step="0.01"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-24 rounded-lg border border-depth-200 px-2 py-1 text-sm"
                        />
                        <button onClick={() => handlePriceUpdate(p._id)} disabled={saving} className="rounded-lg bg-flow-500 px-3 py-1 text-sm font-semibold text-depth-950">
                          Save
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-sm text-depth-500 underline">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingId(p._id);
                          setEditPrice(String(p.unitPrice));
                        }}
                        className="mt-0.5 font-mono text-sm text-flow-600 underline underline-offset-2"
                      >
                        KES {p.unitPrice.toLocaleString()} · edit
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={"rounded-full px-2.5 py-1 text-xs font-medium " + (p.isActive ? "bg-confirm-500/15 text-confirm-600" : "bg-depth-100 text-depth-500")}>
                      {p.isActive ? "Active" : "Inactive"}
                    </span>
                    {p.isActive ? (
                      <ConfirmButton
                        label="Deactivate"
                        confirmLabel="Deactivate"
                        variant="danger"
                        onConfirm={() => handleToggleActive(p)}
                        className="rounded-lg border border-depth-200 px-3 py-1.5 text-sm font-medium text-depth-700"
                      />
                    ) : (
                      <button
                        onClick={() => handleToggleActive(p)}
                        className="rounded-lg border border-depth-200 px-3 py-1.5 text-sm font-medium text-depth-700"
                      >
                        Reactivate
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={handleAdd} className="rounded-xl2 bg-white p-4 shadow-soft">
          <h2 className="mb-3 font-display font-semibold text-depth-900">Add a new size</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-depth-600" htmlFor="label">
                Label
              </label>
              <input id="label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. 10L Jerrycan" className="tap-target w-full rounded-xl border border-depth-200 px-3" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-depth-600" htmlFor="size">
                Size (litres)
              </label>
              <input id="size" type="number" min="0" step="0.1" value={sizeLiters} onChange={(e) => setSizeLiters(e.target.value)} placeholder="10" className="tap-target w-full rounded-xl border border-depth-200 px-3" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-depth-600" htmlFor="price">
                Price (KES)
              </label>
              <input id="price" type="number" min="0" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="110" className="tap-target w-full rounded-xl border border-depth-200 px-3" />
            </div>
          </div>
          <button type="submit" disabled={saving} className="tap-target mt-4 w-full rounded-xl2 bg-flow-500 font-display font-semibold text-depth-950 disabled:opacity-60 sm:w-auto sm:px-8">
            {saving ? "Adding…" : "Add size"}
          </button>
        </form>
      </div>
    </main>
  );
}
