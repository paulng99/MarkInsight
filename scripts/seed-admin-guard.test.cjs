const assert = require("node:assert/strict");
const test = require("node:test");
const {
  isForbiddenSeedIdentity,
  SEED_ADMIN_DEMO_IDENTITY_ERROR,
  MIN_SEED_PASSWORD_LEN,
  validateSeedPassword,
  validateSeedTeacherPassword,
  seedPasswordForHash,
} = require("./seed-admin-guard.cjs");

test("rejects demo email admin@example.com", () => {
  assert.equal(isForbiddenSeedIdentity("admin@example.com"), true);
});

test("rejects uppercase demo email variant", () => {
  assert.equal(isForbiddenSeedIdentity("Admin@Example.COM"), true);
});

test("rejects other @example.com addresses (case-insensitive)", () => {
  assert.equal(isForbiddenSeedIdentity("anyone@EXAMPLE.com"), true);
});

test("rejects demo ids used as identity values", () => {
  assert.equal(isForbiddenSeedIdentity("demo_admin"), true);
  assert.equal(isForbiddenSeedIdentity("DEMO_TEACHER"), true);
  assert.equal(isForbiddenSeedIdentity("demo_student"), true);
});

test("does not reject subdomain like x@school.example.com", () => {
  assert.equal(isForbiddenSeedIdentity("x@school.example.com"), false);
});

test("accepts a normal school email", () => {
  assert.equal(isForbiddenSeedIdentity("you@school.edu.hk"), false);
});

test("exports the written HK Traditional Chinese error copy", () => {
  assert.equal(
    SEED_ADMIN_DEMO_IDENTITY_ERROR,
    "此電郵屬於示範帳戶用途，不能作為正式管理員。請改用學校的真實電郵地址。",
  );
});

test("validateSeedPassword: rejects missing empty and whitespace-only", () => {
  assert.equal(
    validateSeedPassword("MARKINSIGHT_SEED_ADMIN_PASSWORD", null),
    "MARKINSIGHT_SEED_ADMIN_PASSWORD is required.",
  );
  assert.equal(
    validateSeedPassword("MARKINSIGHT_SEED_ADMIN_PASSWORD", ""),
    "MARKINSIGHT_SEED_ADMIN_PASSWORD is required.",
  );
  assert.equal(
    validateSeedPassword("MARKINSIGHT_SEED_ADMIN_PASSWORD", "   "),
    "MARKINSIGHT_SEED_ADMIN_PASSWORD is required.",
  );
});

test("validateSeedPassword: rejects short passwords using raw length", () => {
  assert.equal(
    validateSeedPassword("MARKINSIGHT_SEED_ADMIN_PASSWORD", "short"),
    `MARKINSIGHT_SEED_ADMIN_PASSWORD must be at least ${MIN_SEED_PASSWORD_LEN} characters.`,
  );
});

test("validateSeedPassword: accepts password with leading or trailing spaces", () => {
  const withSpaces = `  ${"a".repeat(MIN_SEED_PASSWORD_LEN)}  `;
  assert.equal(
    validateSeedPassword("MARKINSIGHT_SEED_ADMIN_PASSWORD", withSpaces),
    null,
  );
});

test("seedPasswordForHash never trims admin or teacher passwords", () => {
  const withSpaces = `  ${"b".repeat(MIN_SEED_PASSWORD_LEN)}  `;
  assert.equal(seedPasswordForHash(withSpaces), withSpaces);
  assert.equal(
    seedPasswordForHash("plain-password-ok"),
    "plain-password-ok",
  );
});

test("validateSeedTeacherPassword: skips when teacher email is unset", () => {
  assert.equal(validateSeedTeacherPassword(null, null), null);
  assert.equal(validateSeedTeacherPassword("", ""), null);
  assert.equal(validateSeedTeacherPassword("  ", "x"), null);
});

test("validateSeedTeacherPassword: requires password when teacher email is set", () => {
  assert.equal(
    validateSeedTeacherPassword("teacher@school.edu.hk", null),
    "MARKINSIGHT_SEED_TEACHER_PASSWORD is required when MARKINSIGHT_SEED_TEACHER_EMAIL is set.",
  );
  assert.equal(
    validateSeedTeacherPassword("teacher@school.edu.hk", ""),
    "MARKINSIGHT_SEED_TEACHER_PASSWORD is required when MARKINSIGHT_SEED_TEACHER_EMAIL is set.",
  );
  assert.equal(
    validateSeedTeacherPassword("teacher@school.edu.hk", "   "),
    "MARKINSIGHT_SEED_TEACHER_PASSWORD is required when MARKINSIGHT_SEED_TEACHER_EMAIL is set.",
  );
});

test("validateSeedTeacherPassword: rejects short passwords", () => {
  assert.equal(
    validateSeedTeacherPassword("teacher@school.edu.hk", "short"),
    `MARKINSIGHT_SEED_TEACHER_PASSWORD must be at least ${MIN_SEED_PASSWORD_LEN} characters.`,
  );
});

test("validateSeedTeacherPassword: accepts password of minimum length without trimming", () => {
  const raw = "a".repeat(MIN_SEED_PASSWORD_LEN);
  assert.equal(
    validateSeedTeacherPassword("teacher@school.edu.hk", raw),
    null,
  );
  const withSpaces = ` ${raw} `;
  assert.equal(
    validateSeedTeacherPassword("teacher@school.edu.hk", withSpaces),
    null,
  );
  assert.equal(seedPasswordForHash(withSpaces), withSpaces);
});
