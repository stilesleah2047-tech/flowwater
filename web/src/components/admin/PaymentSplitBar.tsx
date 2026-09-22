"use client";

interface Props {
  cashTotal: number;
  mpesaTotal: number;
}

export default function PaymentSplitBar({ cashTotal, mpesaTotal }: Props) {
  const total = cashTotal + mpesaTotal;
  const cashPct = total > 0 ? (cashTotal / total) * 100 : 0;
  const mpesaPct = total > 0 ? 100 - cashPct : 0;

  return (
    <div className="rounded-xl2 bg-white p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-depth-900">Payment split today</h3>
        <span className="font-mono text-xs text-depth-500">KES {total.toLocaleString()} total</span>
      </div>

      {total === 0 ? (
        <p className="py-2 text-sm text-depth-400">No sales recorded yet today.</p>
      ) : (
        <>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-depth-100">
            <div className="h-full bg-cash-500" style={{ width: cashPct + "%" }} />
            <div className="h-full bg-confirm-500" style={{ width: mpesaPct + "%" }} />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-depth-600">
              <span className="h-2 w-2 rounded-full bg-cash-500" />
              Cash · {cashPct.toFixed(0)}% · KES {cashTotal.toLocaleString()}
            </span>
            <span className="flex items-center gap-1.5 text-depth-600">
              <span className="h-2 w-2 rounded-full bg-confirm-500" />
              M-Pesa · {mpesaPct.toFixed(0)}% · KES {mpesaTotal.toLocaleString()}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
