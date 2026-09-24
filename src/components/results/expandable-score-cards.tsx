"use client";

import { useState } from "react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { Icon } from "@/components/ui/icons";

export type ScoreRow = {
  questionKey: string;
  topic: string;
  itemType: string;
  score: number;
  maxScore: number;
  feedback?: string | null;
};

function ratioTone(r: number) {
  if (r >= 0.75) return { bar: "var(--emerald-500)", badge: "badge-success" };
  if (r >= 0.55) return { bar: "var(--amber-500)", badge: "badge-warn" };
  return { bar: "var(--rose-500)", badge: "badge-error" };
}

export function ExpandableScoreCards({
  scores,
  t,
  colorful = true,
}: {
  scores: ScoreRow[];
  t: Dictionary;
  colorful?: boolean;
}) {
  const [open, setOpen] = useState<string | null>(scores[0]?.questionKey ?? null);

  if (scores.length === 0) {
    return <p className="text-sm text-[var(--muted)]">{t.noScoresYet}</p>;
  }

  const topics = [...new Set(scores.map((s) => s.topic))];
  const itemTypes = [...new Set(scores.map((s) => s.itemType))];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {topics.map((topic, i) => (
          <span
            key={topic}
            className={`topic-chip ${colorful ? "topic-chip--color" : ""}`}
            style={colorful ? { ["--chip-hue" as string]: String(222 + i * 34) } : undefined}
          >
            {t.topicChip}: {topic}
          </span>
        ))}
        {itemTypes.map((itemType, i) => (
          <span
            key={itemType}
            className={`type-chip ${colorful ? "type-chip--color" : ""}`}
            style={colorful ? { ["--chip-hue" as string]: String(160 + i * 40) } : undefined}
          >
            {t.itemTypeChip}: {itemType}
          </span>
        ))}
      </div>

      <ul className="grid gap-2">
        {scores.map((s) => {
          const isOpen = open === s.questionKey;
          const ratio = s.maxScore > 0 ? s.score / s.maxScore : 0;
          const tone = ratioTone(ratio);
          return (
            <li key={s.questionKey}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : s.questionKey)}
                aria-expanded={isOpen}
                className={`score-card w-full border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left transition-[box-shadow,border-color] duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:border-[var(--border-strong)] ${
                  colorful ? "score-card--student" : "score-card--teacher"
                } ${isOpen ? "score-card--open" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 min-w-8 items-center justify-center rounded-md bg-[var(--surface-sunken)] px-2 text-xs font-bold text-[var(--ink)]">
                    {s.questionKey}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-semibold text-[var(--ink)]">
                        {s.topic}
                        <span className="ml-1.5 text-xs font-medium text-[var(--muted)]">
                          · {s.itemType}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-bold tabular-nums text-[var(--ink)]">
                          {s.score}
                          <span className="text-xs font-medium text-[var(--muted)]">/{s.maxScore}</span>
                        </span>
                        <span className={`badge ${tone.badge} hidden sm:inline-flex`}>
                          {Math.round(ratio * 100)}%
                        </span>
                        <Icon.ChevronDown
                          size={16}
                          className={`text-[var(--muted)] transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                      </span>
                    </div>
                    <div className="progress mt-2 !h-1.5" aria-hidden>
                      <span style={{ width: `${Math.round(ratio * 100)}%`, background: colorful ? tone.bar : "var(--color-primary)" }} />
                    </div>
                  </div>
                </div>
                {isOpen ? (
                  <div className="score-card-body mt-3 border-t border-[var(--border)] pt-3 text-sm">
                    {s.feedback ? (
                      <p className="leading-relaxed text-[var(--ink)]">{s.feedback}</p>
                    ) : (
                      <p className="text-[var(--muted)]">
                        {t.topicChip}: {s.topic} · {t.itemTypeChip}: {s.itemType}
                      </p>
                    )}
                  </div>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
