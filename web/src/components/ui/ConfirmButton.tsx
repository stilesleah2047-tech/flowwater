"use client";

import { useState } from "react";

interface Props {
  label: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  className?: string;
  variant?: "default" | "danger";
}

export default function ConfirmButton({
  label,
  confirmLabel = "Confirm",
  onConfirm,
  className = "",
  variant = "default",
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onConfirm();
            setBusy(false);
            setConfirming(false);
          }}
          className={
            "rounded-lg px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60 " +
            (variant === "danger" ? "bg-alert-500" : "bg-flow-600")
          }
        >
          {busy ? "…" : confirmLabel}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="rounded-lg border border-depth-200 px-3 py-1.5 text-sm font-medium text-depth-600"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button type="button" onClick={() => setConfirming(true)} className={className}>
      {label}
    </button>
  );
}
