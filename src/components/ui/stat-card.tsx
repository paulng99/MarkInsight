import type { CSSProperties, ReactNode } from "react";

export type StatTint = "blue" | "violet" | "teal" | "amber" | "rose" | "emerald";

const tints: Record<StatTint, { tint: string; fg: string; bg: string }> = {
  blue: { tint: "var(--blue-50)", fg: "var(--blue-600)", bg: "var(--blue-100)" },
  violet: { tint: "#efeafd", fg: "var(--violet-600)", bg: "#e4dcfb" },
  teal: { tint: "#e3f6f3", fg: "var(--teal-600)", bg: "#cdeee8" },
  amber: { tint: "#fff4e0", fg: "var(--amber-600)", bg: "#fde7bd" },
  rose: { tint: "#fdeaee", fg: "var(--rose-600)", bg: "#fbd5dc" },
  emerald: { tint: "#e6f7f0", fg: "var(--emerald-600)", bg: "#c9eedd" },
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  tint = "blue",
  className = "",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tint?: StatTint;
  className?: string;
}) {
  const c = tints[tint];
  return (
    <div
      className={`stat-card ${className}`}
      style={{ "--stat-tint": c.tint } as CSSProperties}
    >
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            {label}
          </p>
          <p className="display mt-2 text-2xl tabular-nums text-[var(--ink)] sm:text-3xl">{value}</p>
          {hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
        </div>
        {icon ? (
          <span
            className="icon-tile"
            style={{ "--tile-bg": c.bg, "--tile-fg": c.fg } as CSSProperties}
          >
            {icon}
          </span>
        ) : null}
      </div>
    </div>
  );
}
