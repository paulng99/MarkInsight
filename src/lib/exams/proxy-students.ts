/**
 * Teacher proxy-upload student options.
 * Enrolled accounts and emails still waiting to register both appear.
 */

const PENDING_STUDENT_PREFIX = "pending:";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ProxyStudentSource = {
  enrollmentId: string;
  studentId: string;
  name: string | null;
  email: string;
  submission: { id: string; status: string } | null;
};

export type ProxyStudentRow = ProxyStudentSource & {
  pending: boolean;
};

export function normalizeProxyEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function pendingStudentOptionId(email: string): string {
  return `${PENDING_STUDENT_PREFIX}${normalizeProxyEmail(email)}`;
}

/** Student id from the proxy dropdown, or null when it is a real user id. */
export function pendingEmailFromOptionId(studentId: string): string | null {
  if (!studentId.startsWith(PENDING_STUDENT_PREFIX)) return null;
  const email = normalizeProxyEmail(studentId.slice(PENDING_STUDENT_PREFIX.length));
  if (!email || email.length > 254 || !EMAIL.test(email)) return null;
  return email;
}

export function toProxyStudentRows(
  enrolled: ProxyStudentSource[],
  pendingEmails: string[],
): ProxyStudentRow[] {
  const seen = new Set<string>();
  const rows: ProxyStudentRow[] = [];

  for (const row of enrolled) {
    const email = normalizeProxyEmail(row.email);
    if (email) seen.add(email);
    rows.push({ ...row, pending: false });
  }

  for (const raw of pendingEmails) {
    const email = normalizeProxyEmail(raw);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    rows.push({
      enrollmentId: "",
      studentId: pendingStudentOptionId(email),
      name: null,
      email,
      submission: null,
      pending: true,
    });
  }

  rows.sort((a, b) => a.email.localeCompare(b.email, "en"));
  return rows;
}
