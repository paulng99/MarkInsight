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
 * Validate a seed password without trimming it.
 * Presence uses a whitespace check only; the accepted value for hashing is the
 * raw string so leading/trailing spaces match what the operator set in env.
 *
 * @param {string} envName
 * @param {string | null | undefined} password
 * @returns {string | null} English error message, or null when OK
 */
function validateSeedPassword(envName, password) {
  if (password == null || String(password) === "") {
    return `${envName} is required.`;
  }
  const raw = String(password);
  if (!raw.trim()) {
    return `${envName} is required.`;
  }
  if (raw.length < MIN_SEED_PASSWORD_LEN) {
    return `${envName} must be at least ${MIN_SEED_PASSWORD_LEN} characters.`;
  }
  return null;
}

/**
 * When a teacher email is set, require a teacher password that passes
 * {@link validateSeedPassword}. Call this before opening a DB connection
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
  const err = validateSeedPassword(
    "MARKINSIGHT_SEED_TEACHER_PASSWORD",
    teacherPassword,
  );
  if (!err) return null;
  if (err === "MARKINSIGHT_SEED_TEACHER_PASSWORD is required.") {
    return "MARKINSIGHT_SEED_TEACHER_PASSWORD is required when MARKINSIGHT_SEED_TEACHER_EMAIL is set.";
  }
  return err;
}

/**
 * Password string to hash: never trimmed.
 *
 * @param {string} password
 * @returns {string}
 */
function seedPasswordForHash(password) {
  return String(password);
}

module.exports = {
  DEMO_IDENTITY_EXACT,
  MIN_SEED_PASSWORD_LEN,
  SEED_ADMIN_DEMO_IDENTITY_ERROR,
  isForbiddenSeedIdentity,
  validateSeedPassword,
  validateSeedTeacherPassword,
  seedPasswordForHash,
};
