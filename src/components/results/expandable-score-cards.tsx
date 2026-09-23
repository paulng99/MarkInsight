"use client";

import { useState } from "react";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export type ScoreRow = {
  questionKey: string;
  topic: string;
  itemType: string;
  score: number;
  maxScore: number;
  feedback?: string | null;
};

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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {[...new Set(scores.map((s) => s.topic))].map((topic, i) => (
          <span
            key={topic}
            className={`topic-chip text-xs font-semibold ${colorful ? "topic-chip--color" : ""}`}
            style={
              colorful
                ? { ["--chip-hue" as string]: String(190 + i * 35) }
                : undefined
            }
          >
            {t.topicChip}: {topic}
          </span>
        ))}
        {[...new Set(scores.map((s) => s.itemType))].map((itemType, i) => (
          <span
            key={itemType}
            className={`type-chip text-xs font-semibold ${colorful ? "type-chip--color" : ""}`}
            style={
              colorful
                ? { ["--chip-hue" as string]: String(150 + i * 40) }
                : undefined
            }
          >
            {t.itemTypeChip}: {itemType}
          </span>
        ))}
      </div>

      <ul className="space-y-2">
        {scores.map((s) => {
          const isOpen = open === s.questionKey;
          return (
            <li key={s.questionKey}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : s.questionKey)}
                className={`score-card w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left transition-[box-shadow,transform] duration-[var(--motion-fast)] ease-[var(--ease-out)] ${
                  colorful ? "score-card--student" : "score-card--teacher"
                } ${isOpen ? "score-card--open" : ""}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-[var(--ink)]">
                    {s.questionKey}
                  </span>
                  <span className="text-sm text-[var(--muted)]">
                    {t.scoreLabel}: {s.score}/{s.maxScore}
                  </span>
                </div>
                {isOpen ? (
                  <div className="score-card-body mt-3 text-sm text-[var(--muted)]">
                    <p>
                      {t.topicChip}: {s.topic} · {t.itemTypeChip}: {s.itemType}
                    </p>
                    {s.feedback ? (
                      <p className="mt-2 text-[var(--ink)]">{s.feedback}</p>
                    ) : null}
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
