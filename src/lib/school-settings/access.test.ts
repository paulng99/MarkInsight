/**
 * Minimal coverage for admin-only access helpers used by
 * /api/admin/class-subjects and /api/admin/subjects/[subjectCode].
 *
 * Documents current schoolId resolution: requested schoolId wins over the
 * session schoolId (cross-school is NOT rejected at this layer).
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  assertCanAccessSchoolSettings,
  canAccessSchoolSettings,
  DEMO_SCHOOL_ID,
  resolveAdminSchoolId,
} from "./access.ts";

test("canAccessSchoolSettings allows ADMIN only", () => {
  assert.equal(canAccessSchoolSettings("ADMIN"), true);
  assert.equal(canAccessSchoolSettings("TEACHER"), false);
  assert.equal(canAccessSchoolSettings("STUDENT"), false);
  assert.equal(canAccessSchoolSettings(null), false);
  assert.equal(canAccessSchoolSettings(undefined), false);
});

test("assertCanAccessSchoolSettings rejects non-admin", () => {
  assert.doesNotThrow(() => assertCanAccessSchoolSettings("ADMIN"));
  assert.throws(
    () => assertCanAccessSchoolSettings("TEACHER"),
    /Forbidden: school settings are admin-only/,
  );
  assert.throws(
    () => assertCanAccessSchoolSettings("STUDENT"),
    /Forbidden: school settings are admin-only/,
  );
  assert.throws(
    () => assertCanAccessSchoolSettings(undefined),
    /Forbidden: school settings are admin-only/,
  );
});

test("resolveAdminSchoolId prefers requested schoolId over session (no cross-school reject)", () => {
  assert.equal(
    resolveAdminSchoolId("school_a", "school_b"),
    "school_b",
  );
  assert.equal(resolveAdminSchoolId("school_a", null), "school_a");
  assert.equal(resolveAdminSchoolId("school_a", "  "), "school_a");
  assert.equal(resolveAdminSchoolId(null, null), DEMO_SCHOOL_ID);
  assert.equal(resolveAdminSchoolId(undefined, undefined), DEMO_SCHOOL_ID);
});
