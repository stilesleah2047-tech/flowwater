"use client";

import { Product } from "@/lib/types";

interface Props {
  products: Product[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function ProductSizeSelector({ products, selectedId, onSelect }: Props) {
  if (products.length === 0) {
    return (
      <div className="rounded-xl2 border border-dashed border-depth-200 bg-white p-4 text-center text-sm text-depth-500">
        No jerrycan sizes configured yet.
      </div>
    );
  }
  const maxSize = Math.max(...products.map((p) => p.sizeLiters));

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-depth-600">Jerrycan size</span>
      <div role="radiogroup" aria-label="Jerrycan size" className="flex flex-wrap gap-2">
        {products.map((p) => {
          const isSelected = p._id === selectedId;
          const scale = 0.7 + 0.3 * (p.sizeLiters / maxSize);
          return (
            <button
              key={p._id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(p._id)}
              className={
                "tap-target flex items-center gap-2 rounded-xl2 border-2 px-4 transition " +
                (isSelected ? "border-flow-500 bg-flow-500/10 text-depth-900" : "border-depth-200 bg-white text-depth-600")
              }
            >
              <svg width={18 * scale} height={22 * scale} viewBox="0 0 24 28" className={isSelected ? "text-flow-500" : "text-depth-300"}>
                <rect x="4" y="6" width="16" height="20" rx="2" fill="currentColor" />
                <rect x="9" y="2" width="6" height="5" rx="1" fill="currentColor" />
              </svg>
              <span className="text-left leading-tight">
                <span className="block font-display text-sm font-bold">{p.sizeLiters}L</span>
                <span className="block font-mono text-xs text-depth-500">KES {p.unitPrice.toLocaleString()}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
