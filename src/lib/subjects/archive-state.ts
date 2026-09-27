/** Pure archive rules. A class is usable only when both timestamps are empty. */

export const activeClassWhere = {
  classArchivedAt: null,
  subjectArchivedAt: null,
} as const;

export function isClassInactive(row: {
  classArchivedAt: Date | null;
  subjectArchivedAt: Date | null;
}): boolean {
  return row.classArchivedAt != null || row.subjectArchivedAt != null;
}

/** Archive timestamps shown in the UI use yyyy-mm-dd in Hong Kong. */
export function formatArchiveDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
