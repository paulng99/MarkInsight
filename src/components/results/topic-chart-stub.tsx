"use client";

import { useState } from "react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { Icon } from "@/components/ui/icons";

export type ChartDatum = {
  topic: string;
  ratio: number;
};

const series = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

/**
 * Bar chart by topic (CSS only). Student view is full-chroma; teacher view is
 * slightly desaturated. Bars carry a value label so colour is never the only
 * signal.
 */
export function TopicChartStub({
  data,
  t,
  intensity = "high",
}: {
  data: ChartDatum[];
  t: Dictionary;
  intensity?: "high" | "medium";
}) {
  const [active, setActive] = useState<string | null>(null);

  if (data.length === 0) {
    return <p className="text-sm text-[var(--muted)]">{t.stateEmpty}</p>;
  }

  return (
    <div className={`chart-stub chart-stub--${intensity}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="section-title flex items-center gap-2">
            <Icon.BarChart size={18} className="text-primary-600" />
            {t.chartStubTitle}
          </h3>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{t.chartStubHint}</p>
        </div>
        {active ? (
          <span className="badge badge-info">
            {active}: {Math.round((data.find((d) => d.topic === active)?.ratio ?? 0) * 100)}%
          </span>
        ) : null}
      </div>

      <div className="relative mt-5">
        {/* gridlines */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-44">
          {[100, 75, 50, 25].map((g) => (
            <div
              key={g}
              className="absolute inset-x-0 flex items-center gap-2 text-[10px] text-[var(--faint)]"
              style={{ top: `${100 - g}%` }}
            >
              <span className="w-7 text-right tabular-nums">{g}%</span>
              <span className="h-px flex-1 bg-[var(--border)]" />
            </div>
          ))}
        </div>

        <div className="ml-9 flex h-44 items-end gap-2 sm:gap-3">
          {data.map((d, i) => {
            const height = Math.round(d.ratio * 100);
            const isActive = active === d.topic;
            const color = series[i % series.length];
            return (
              <button
                key={d.topic}
                type="button"
                onClick={() => setActive(isActive ? null : d.topic)}
                className="group relative flex h-full flex-1 flex-col justify-end"
                aria-pressed={isActive}
                aria-label={`${d.topic}: ${height}%`}
                title={`${d.topic}: ${height}%`}
              >
                <span
                  className="pointer-events-none mb-1 text-center text-[10px] font-bold tabular-nums text-[var(--ink-secondary)] opacity-0 transition-opacity group-hover:opacity-100 group-aria-pressed:opacity-100"
                >
                  {height}%
                </span>
                <span
                  className="chart-bar mx-auto w-full max-w-14 rounded-t-lg transition-[height,filter,opacity] duration-[var(--motion-slow)] ease-[var(--ease-out)]"
                  style={{
                    height: `${Math.max(3, height)}%`,
                    background: `linear-gradient(180deg, ${color}, color-mix(in srgb, ${color} 70%, white))`,
                    opacity: intensity === "high" ? 1 : 0.8,
                    filter: isActive ? "saturate(1.25)" : active ? "saturate(0.6) opacity(0.7)" : undefined,
                  }}
                />
              </button>
            );
          })}
        </div>
        <div className="ml-9 mt-2 flex gap-2 sm:gap-3">
          {data.map((d) => (
            <span
              key={d.topic}
              className={`flex-1 truncate text-center text-[10px] font-semibold ${
                active === d.topic ? "text-primary-700" : "text-[var(--muted)]"
              }`}
              title={d.topic}
            >
              {d.topic}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
