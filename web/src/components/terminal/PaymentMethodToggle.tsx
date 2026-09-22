"use client";

import { PaymentMethod } from "@/lib/types";

interface Props {
  value: PaymentMethod;
  onChange: (m: PaymentMethod) => void;
}

export default function PaymentMethodToggle({ value, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-2 gap-2 rounded-xl2 bg-sand-100 p-1.5">
      <button
        type="button"
        role="radio"
        aria-checked={value === "CASH"}
        onClick={() => onChange("CASH")}
        className={
          "tap-target rounded-xl font-display font-semibold transition " +
          (value === "CASH" ? "bg-cash-500 text-white shadow-soft" : "text-depth-600")
        }
      >
        💵 Cash
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === "MPESA"}
        onClick={() => onChange("MPESA")}
        className={
          "tap-target rounded-xl font-display font-semibold transition " +
          (value === "MPESA" ? "bg-confirm-500 text-white shadow-soft" : "text-depth-600")
        }
      >
        📱 M-Pesa
      </button>
    </div>
  );
}
