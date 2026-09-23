"use client";

import { useState } from "react";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export type ChartDatum = {
  topic: string;
  ratio: number;
};

export function TopicChartStub({
  data,
  t,
  intensity = "high",
}: {
  data: ChartDatum[];
  t: Dictionary;
  /** Student = high chroma/motion; teacher = half. */
  intensity?: "high" | "medium";
}) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(1, ...data.map((d) => d.ratio));
  const chroma = intensity === "high" ? 1 : 0.55;

  if (data.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">{t.stateEmpty}</p>
    );
  }

  return (
    <div className={`chart-stub chart-stub--${intensity}`}>
      <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--ink)]">
        {t.chartStubTitle}
      </h3>
      <p className="mt-1 text-sm text-[var(--muted)]">{t.chartStubHint}</p>
      <div className="mt-4 flex h-40 items-end gap-2">
        {data.map((d, i) => {
          const height = Math.round((d.ratio / max) * 100);
          const isActive = active === d.topic;
          const hue = 200 + i * 28;
          return (
            <button
              key={d.topic}
              type="button"
              onClick={() => setActive(isActive ? null : d.topic)}
              className="group flex flex-1 flex-col items-center gap-2"
              aria-pressed={isActive}
            >
              <div className="relative flex h-32 w-full items-end justify-center">
                <span
                  className="chart-bar w-full max-w-12 rounded-t-md transition-[height,filter,transform] duration-[var(--motion-base)] ease-[var(--ease-out)]"
                  style={{
                    height: `${Math.max(8, height)}%`,
                    background: `hsla(${hue}, 72%, ${isActive ? 42 : 52}%, ${chroma})`,
                    transform: isActive ? "scaleY(1.04)" : undefined,
                    filter: isActive ? "saturate(1.2)" : undefined,
                  }}
                />
              </div>
              <span
                className={`text-[10px] font-medium ${
                  isActive ? "text-[var(--brand-deep)]" : "text-[var(--muted)]"
                }`}
              >
                {d.topic}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
