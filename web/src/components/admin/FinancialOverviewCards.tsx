"use client";

interface Props {
  cashTotal: number;
  mpesaTotal: number;
  totalSales: number;
  pendingMpesa: number;
}

function Card({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl2 bg-white p-4 shadow-soft">
      <p className="text-xs font-medium uppercase tracking-wide text-depth-500">{label}</p>
      <p className={"mt-1 font-display text-2xl font-bold " + accent}>{value}</p>
    </div>
  );
}

export default function FinancialOverviewCards({ cashTotal, mpesaTotal, totalSales, pendingMpesa }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card label="Cash Collected" value={"KES " + cashTotal.toLocaleString()} accent="text-cash-600" />
      <Card label="M-Pesa Revenue" value={"KES " + mpesaTotal.toLocaleString()} accent="text-confirm-600" />
      <Card label="Sales Today" value={String(totalSales)} accent="text-depth-900" />
      <Card label="Pending M-Pesa" value={String(pendingMpesa)} accent="text-alert-600" />
    </div>
  );
}
