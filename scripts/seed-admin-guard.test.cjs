const assert = require("node:assert/strict");
const test = require("node:test");
const {
  isForbiddenSeedIdentity,
  SEED_ADMIN_DEMO_IDENTITY_ERROR,
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
