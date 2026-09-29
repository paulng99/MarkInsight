import assert from "node:assert/strict";
import test from "node:test";
import {
  CROSS_SCHOOL_FORBIDDEN_CODE,
  CrossSchoolAccessError,
  DEMO_SCHOOL_ID,
  assertCanAccessSchoolSettings,
  canAccessSchoolSettings,
  resolveAdminSchoolId,
  schoolIdFromAdminSession,
  tryResolveAdminSchoolId,
} from "./access.ts";

test("canAccessSchoolSettings allows only ADMIN", () => {
  assert.equal(canAccessSchoolSettings("ADMIN"), true);
  assert.equal(canAccessSchoolSettings("TEACHER"), false);
  assert.equal(canAccessSchoolSettings("STUDENT"), false);
  assert.equal(canAccessSchoolSettings(null), false);
  assert.equal(canAccessSchoolSettings(undefined), false);
});

test("assertCanAccessSchoolSettings rejects non-admins", () => {
  assert.doesNotThrow(() => assertCanAccessSchoolSettings("ADMIN"));
  assert.throws(
    () => assertCanAccessSchoolSettings("TEACHER"),
    /admin-only/i,
  );
  assert.throws(
    () => assertCanAccessSchoolSettings("STUDENT"),
    /admin-only/i,
  );
});

test("schoolIdFromAdminSession uses session then demo stub", () => {
  assert.equal(schoolIdFromAdminSession("school_a"), "school_a");
  assert.equal(schoolIdFromAdminSession("  school_a  "), "school_a");
  assert.equal(schoolIdFromAdminSession(null), DEMO_SCHOOL_ID);
  assert.equal(schoolIdFromAdminSession(undefined), DEMO_SCHOOL_ID);
  assert.equal(schoolIdFromAdminSession(""), DEMO_SCHOOL_ID);
});

test("resolveAdminSchoolId prefers session and rejects a different requested school", () => {
  assert.equal(resolveAdminSchoolId("school_a"), "school_a");
  assert.equal(resolveAdminSchoolId("school_a", "school_a"), "school_a");
  assert.equal(resolveAdminSchoolId("school_a", "  school_a  "), "school_a");
  assert.equal(resolveAdminSchoolId(null, null), DEMO_SCHOOL_ID);
  assert.equal(resolveAdminSchoolId(null, DEMO_SCHOOL_ID), DEMO_SCHOOL_ID);

  assert.throws(
    () => resolveAdminSchoolId("school_a", "school_b"),
    (error: unknown) =>
      error instanceof CrossSchoolAccessError &&
      error.status === 403 &&
      error.code === CROSS_SCHOOL_FORBIDDEN_CODE,
  );
  assert.throws(
    () => resolveAdminSchoolId(null, "other_school"),
    (error: unknown) =>
      error instanceof CrossSchoolAccessError && error.status === 403,
  );
});

test("tryResolveAdminSchoolId returns 403 for cross-school requests", () => {
  const ok = tryResolveAdminSchoolId("school_a", "school_a");
  assert.deepEqual(ok, { ok: true, schoolId: "school_a" });

  const denied = tryResolveAdminSchoolId("school_a", "school_b");
  assert.equal(denied.ok, false);
  if (!denied.ok) {
    assert.equal(denied.status, 403);
    assert.equal(denied.code, CROSS_SCHOOL_FORBIDDEN_CODE);
  }
});
