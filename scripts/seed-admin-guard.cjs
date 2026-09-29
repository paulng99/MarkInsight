/**
 * Pure helpers that refuse demo identities for seed-admin.
 * Safe to unit-test; does not touch the database or process.env.
 */

const DEMO_IDENTITY_EXACT = new Set([
  "admin@example.com",
  "teacher@example.com",
  "student@example.com",
  "demo_admin",
  "demo_teacher",
  "demo_student",
]);

/** Written Hong Kong Traditional Chinese — designer-approved seed-admin copy. */
const SEED_ADMIN_DEMO_IDENTITY_ERROR =
  "此電郵屬於示範帳戶用途，不能作為正式管理員。請改用學校的真實電郵地址。";

const MIN_SEED_PASSWORD_LEN = 12;

/**
 * True when `value` is a reserved demo id/email, or an email whose domain is
 * exactly `example.com` (case-insensitive). Subdomains such as
 * `x@school.example.com` are allowed.
 *
 * @param {string | null | undefined} value
 * @returns {boolean}
 */
function isForbiddenSeedIdentity(value) {
  if (value == null) return false;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return false;
  if (DEMO_IDENTITY_EXACT.has(normalized)) return true;
  return normalized.endsWith("@example.com");
}

/**
 * When a teacher email is set, require a non-empty teacher password of at least
 * MIN_SEED_PASSWORD_LEN characters. Call this before opening a DB connection
 * so a missing teacher password cannot leave a newly written admin behind.
 *
 * @param {string | null | undefined} teacherEmail
 * @param {string | null | undefined} teacherPassword
 * @returns {string | null} English error message for the CLI, or null when OK
 */
function validateSeedTeacherPassword(teacherEmail, teacherPassword) {
  if (teacherEmail == null || !String(teacherEmail).trim()) {
    return null;
  }
  const password =
    teacherPassword == null ? "" : String(teacherPassword);
  if (!password.trim()) {
    return "MARKINSIGHT_SEED_TEACHER_PASSWORD is required when MARKINSIGHT_SEED_TEACHER_EMAIL is set.";
  }
  if (password.length < MIN_SEED_PASSWORD_LEN) {
    return `MARKINSIGHT_SEED_TEACHER_PASSWORD must be at least ${MIN_SEED_PASSWORD_LEN} characters.`;
  }
  return null;
}

module.exports = {
  DEMO_IDENTITY_EXACT,
  MIN_SEED_PASSWORD_LEN,
  SEED_ADMIN_DEMO_IDENTITY_ERROR,
  isForbiddenSeedIdentity,
  validateSeedTeacherPassword,
};
