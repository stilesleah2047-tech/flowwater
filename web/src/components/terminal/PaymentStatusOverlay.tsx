"use client";

export type MpesaUiState = "AWAITING_PIN" | "SUCCESS" | "FAILED";

interface Props {
  state: MpesaUiState;
  amount: number;
  receiptNumber?: string | null;
  failureReason?: string | null;
  onRetry: () => void;
  onNewSale: () => void;
  onDismiss: () => void;
}

export default function PaymentStatusOverlay({ state, amount, receiptNumber, failureReason, onRetry, onNewSale, onDismiss }: Props) {
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-depth-950/95 px-6 text-center animate-fade-up">
      {state === "AWAITING_PIN" && (
        <>
          <div className="relative mb-8 flex h-24 w-24 items-center justify-center">
            <span className="absolute inset-0 rounded-full border-4 border-flow-500/20" />
            <span className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-flow-500" />
            <span className="text-3xl">📲</span>
          </div>
          <h2 className="font-display text-xl font-bold text-white">Awaiting Customer PIN entry…</h2>
          <p className="mt-2 text-sand-200/70">KES {amount.toLocaleString()} · Ask the customer to check their phone</p>
          <button onClick={onDismiss} className="mt-10 text-sm text-sand-200/50 underline underline-offset-4">
            Cancel and keep waiting in background
          </button>
        </>
      )}

      {state === "SUCCESS" && (
        <>
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-confirm-500/15">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <path d="M20 6 9 17l-5-5" stroke="#22B36B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="font-display text-2xl font-bold text-white">Payment Received</h2>
          <p className="mt-2 text-sand-200/70">KES {amount.toLocaleString()}</p>
          {receiptNumber && <p className="mt-1 font-mono text-sm text-flow-400">Receipt: {receiptNumber}</p>}
          <button
            onClick={onNewSale}
            className="tap-target mt-10 w-full max-w-xs rounded-xl2 bg-flow-500 font-display font-semibold text-depth-950 active:scale-[0.98]"
          >
            Start next sale
          </button>
        </>
      )}

      {state === "FAILED" && (
        <>
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-alert-500/15">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6 6 18" stroke="#D9603B" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="font-display text-xl font-bold text-white">Payment Failed / Timed Out</h2>
          <p className="mt-2 text-sand-200/70">{failureReason || "The customer may have cancelled or entered the wrong PIN."}</p>
          <div className="mt-10 flex w-full max-w-xs flex-col gap-3">
            <button onClick={onRetry} className="tap-target rounded-xl2 bg-flow-500 font-display font-semibold text-depth-950 active:scale-[0.98]">
              Retry payment
            </button>
            <button onClick={onDismiss} className="tap-target rounded-xl2 border border-white/15 font-display font-semibold text-white">
              Switch to cash instead
            </button>
          </div>
        </>
      )}
    </div>
  );
}
