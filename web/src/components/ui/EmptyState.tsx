"use client";

import Link from "next/link";

interface Props {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick?: () => void; href?: string };
}

/**
 * A blank "No X yet" text string is a dead end, especially on a brand-new
 * Super Admin's first visit. This turns that moment into a nudge toward
 * the next action instead — every list page's zero-state should use this
 * rather than a plain sentence.
 */
export default function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-flow-500/10 text-2xl text-flow-600">
        {icon}
      </div>
      <h3 className="font-display text-base font-semibold text-depth-900">{title}</h3>
      <p className="mt-1.5 max-w-xs text-sm text-depth-500">{description}</p>
      {action &&
        (action.href ? (
          <Link
            href={action.href}
            className="tap-target mt-5 inline-flex items-center rounded-xl2 bg-flow-500 px-5 font-display text-sm font-semibold text-depth-950 active:scale-[0.98]"
          >
            {action.label}
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className="tap-target mt-5 inline-flex items-center rounded-xl2 bg-flow-500 px-5 font-display text-sm font-semibold text-depth-950 active:scale-[0.98]"
          >
            {action.label}
          </button>
        ))}
    </div>
  );
}
