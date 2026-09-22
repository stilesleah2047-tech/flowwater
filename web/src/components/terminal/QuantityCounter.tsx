"use client";

interface Props {
  quantity: number;
  onChange: (q: number) => void;
  unitPrice: number;
  sizeLabel: string;
  max?: number;
}

export default function QuantityCounter({ quantity, onChange, unitPrice, sizeLabel, max = 200 }: Props) {
  const dec = () => onChange(Math.max(1, quantity - 1));
  const inc = () => onChange(Math.min(max, quantity + 1));

  return (
    <div className="rounded-xl2 border border-depth-200/60 bg-white p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-depth-600">{sizeLabel} jerrycans</span>
        <span className="font-mono text-sm text-depth-600">KES {unitPrice.toLocaleString()} each</span>
      </div>

      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={dec}
          aria-label="Decrease quantity"
          className="tap-target flex w-16 items-center justify-center rounded-xl2 bg-sand-100 text-3xl font-bold text-depth-800 active:scale-95"
        >
          –
        </button>

        <div className="text-center">
          <div className="font-display text-4xl font-extrabold text-depth-900">{quantity}</div>
          <div className="font-mono text-sm text-depth-600">KES {(quantity * unitPrice).toLocaleString()}</div>
        </div>

        <button
          type="button"
          onClick={inc}
          aria-label="Increase quantity"
          className="tap-target flex w-16 items-center justify-center rounded-xl2 bg-flow-500 text-3xl font-bold text-depth-950 active:scale-95"
        >
          +
        </button>
      </div>
    </div>
  );
}
