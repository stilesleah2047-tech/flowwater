"use client";

function base(extra: string) {
  return "animate-pulse rounded-lg bg-depth-100 " + extra;
}

export function SkeletonLine({ width = "100%" }: { width?: string }) {
  return <div className={base("h-3.5")} style={{ width }} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl2 bg-white p-4 shadow-soft">
      <div className={base("h-3 w-2/3 mb-3")} />
      <div className={base("h-6 w-1/2")} />
    </div>
  );
}

export function SkeletonCardGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="rounded-xl2 bg-white shadow-soft">
      <div className="border-b border-depth-100 px-4 py-3">
        <div className={base("h-4 w-32")} />
      </div>
      <ul className="divide-y divide-depth-100">
        {Array.from({ length: rows }).map((_, i) => (
          <li key={i} className="flex items-center justify-between px-4 py-3">
            <div className="space-y-2">
              <div className={base("h-3.5 w-40")} />
              <div className={base("h-3 w-24")} />
            </div>
            <div className={base("h-6 w-16")} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SkeletonTable({ rows = 4, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-xl2 bg-white shadow-soft">
      <div className="border-b border-depth-100 px-4 py-3">
        <div className={base("h-4 w-40")} />
      </div>
      <div className="p-4 space-y-3">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <div key={c} className={base("h-3.5 flex-1")} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
