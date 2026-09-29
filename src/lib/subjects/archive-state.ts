/** Pure archive rules. A class is usable only when every archive timestamp is empty. */

export const activeClassWhere = {
  archivedAt: null,
  classArchivedAt: null,
  subjectArchivedAt: null,
} as const;

export function isClassInactive(row: {
  archivedAt?: Date | null;
  classArchivedAt: Date | null;
  subjectArchivedAt: Date | null;
}): boolean {
  return (
    row.archivedAt != null ||
    row.classArchivedAt != null ||
    row.subjectArchivedAt != null
  );
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
