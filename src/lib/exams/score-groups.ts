export type MarkGroup = {
  label: string;
  ratio: number;
};

function markRatio(score: number, maxScore: number): number {
  if (!(maxScore > 0) || !Number.isFinite(score)) return 0;
  return Math.min(1, Math.max(0, score / maxScore));
}

/** Mark-weighted score ratio for each label, in first-seen order. */
export function groupedMarkRatios(
  rows: Array<{ key: string; score: number; maxScore: number }>,
): MarkGroup[] {
  const order: string[] = [];
  const totals = new Map<string, { score: number; max: number }>();
  for (const row of rows) {
    const key = row.key.trim() || "—";
    const cur = totals.get(key);
    if (!cur) {
      order.push(key);
      totals.set(key, { score: row.score, max: row.maxScore });
      continue;
    }
    cur.score += row.score;
    cur.max += row.maxScore;
  }
  return order.flatMap((label) => {
    const totalsForLabel = totals.get(label);
    if (!totalsForLabel || totalsForLabel.max <= 0) return [];
    return [{ label, ratio: markRatio(totalsForLabel.score, totalsForLabel.max) }];
  });
}
