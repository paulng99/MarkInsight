import type { Dictionary } from "@/lib/i18n/dictionaries";
import { Icon } from "@/components/ui/icons";
import type { ScoreRow } from "./expandable-score-cards";

export type Summary = {
  score: number;
  maxScore: number;
  ratio: number;
  strongest: { topic: string; ratio: number } | null;
  weakest: { topic: string; ratio: number } | null;
};

export function summarize(scores: ScoreRow[]): Summary {
  let score = 0;
  let maxScore = 0;
  const byTopic = new Map<string, { score: number; max: number }>();
  for (const s of scores) {
    score += s.score;
    maxScore += s.maxScore;
    const cur = byTopic.get(s.topic) ?? { score: 0, max: 0 };
    cur.score += s.score;
    cur.max += s.maxScore;
    byTopic.set(s.topic, cur);
  }
  const topics = [...byTopic.entries()]
    .filter(([, v]) => v.max > 0)
    .map(([topic, v]) => ({ topic, ratio: v.score / v.max }))
    .sort((a, b) => b.ratio - a.ratio);
  return {
    score,
    maxScore,
    ratio: maxScore > 0 ? score / maxScore : 0,
    strongest: topics[0] ?? null,
    weakest: topics.length > 1 ? topics[topics.length - 1] : null,
  };
}

function pct(r: number) {
  return `${Math.round(r * 100)}%`;
}

function ratioTone(r: number) {
  if (r >= 0.75) return "var(--emerald-600)";
  if (r >= 0.55) return "var(--amber-600)";
  return "var(--rose-600)";
}

/** Three headline numbers: overall %, strongest topic, weakest topic. */
export function ResultSummary({
  summary,
  t,
  className = "",
}: {
  summary: Summary;
  t: Dictionary;
  className?: string;
}) {
  const ring = Math.round(summary.ratio * 100);
  return (
    <div className={`grid gap-3 sm:grid-cols-3 ${className}`}>
      <div className="flex items-center gap-4 rounded-xl bg-[var(--surface-muted)] px-4 py-3">
        <span
          className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(${ratioTone(summary.ratio)} ${ring}%, var(--slate-200) 0)`,
          }}
          aria-hidden
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-xs font-bold tabular-nums text-[var(--ink)]">
            {ring}%
          </span>
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            {t.overallScore}
          </p>
          <p className="display mt-0.5 text-xl tabular-nums text-[var(--ink)]">
            {summary.score}
            <span className="text-sm font-medium text-[var(--muted)]"> / {summary.maxScore}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl bg-[var(--color-success-soft)] px-4 py-3">
        <span className="icon-tile" style={{ ["--tile-bg" as string]: "#c9eedd", ["--tile-fg" as string]: "var(--emerald-600)" }}>
          <Icon.TrendingUp size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--emerald-600)]">
            {t.strongestTopic}
          </p>
          <p className="truncate text-sm font-bold text-[var(--ink)]">
            {summary.strongest ? summary.strongest.topic : "—"}
            {summary.strongest ? (
              <span className="ml-1.5 text-xs font-semibold text-[var(--emerald-600)]">
                {pct(summary.strongest.ratio)}
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl bg-[var(--color-error-soft)] px-4 py-3">
        <span className="icon-tile" style={{ ["--tile-bg" as string]: "#fbd5dc", ["--tile-fg" as string]: "var(--rose-600)" }}>
          <Icon.Target size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--rose-600)]">
            {t.weakestTopic}
          </p>
          <p className="truncate text-sm font-bold text-[var(--ink)]">
            {summary.weakest ? summary.weakest.topic : "—"}
            {summary.weakest ? (
              <span className="ml-1.5 text-xs font-semibold text-[var(--rose-600)]">
                {pct(summary.weakest.ratio)}
              </span>
            ) : null}
          </p>
        </div>
      </div>
    </div>
  );
}
