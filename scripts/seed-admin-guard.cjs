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

module.exports = {
  DEMO_IDENTITY_EXACT,
  SEED_ADMIN_DEMO_IDENTITY_ERROR,
  isForbiddenSeedIdentity,
};
