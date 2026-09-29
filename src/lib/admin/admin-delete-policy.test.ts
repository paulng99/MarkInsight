/**
 * Policy-level coverage for admin delete + school isolation decisions used by
 * `/api/admin/*` routes. Full HTTP route handlers are not exercised here
 * (auth + Prisma would be required); see access.test.ts and delete-confirm.test.ts.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_BULK_DELETE_ARCHIVED_CONFIRM,
  ADMIN_DELETE_REJECTED_CODE,
  ADMIN_DELETE_REJECTED_MESSAGE_EN,
  evaluateBulkDeleteArchivedGuards,
  evaluateDeleteConfirmation,
  evaluateDeleteImpactFreshness,
} from "./delete-confirm.ts";
import {
  assertCanAccessSchoolSettings,
  tryResolveAdminSchoolId,
} from "../school-settings/access.ts";

function decideAdminDeleteRequest(input: {
  role: "ADMIN" | "TEACHER" | "STUDENT" | null;
  sessionSchoolId: string | null;
  requestedSchoolId?: string | null;
  confirm?: unknown;
  expectedToken: string;
  hasProtectedData: boolean;
  expectedExams?: unknown;
  expectedSubmissions?: unknown;
  actualExams?: number;
  actualSubmissions?: number;
}):
  | { status: 403; code: string; error: string }
  | { status: 400; code: string; error: string }
  | { status: 200; schoolId: string } {
  try {
    assertCanAccessSchoolSettings(input.role);
  } catch {
    return {
      status: 403,
      code: ADMIN_DELETE_REJECTED_CODE,
      error: ADMIN_DELETE_REJECTED_MESSAGE_EN,
    };
  }

  const school = tryResolveAdminSchoolId(
    input.sessionSchoolId,
    input.requestedSchoolId,
  );
  if (!school.ok) {
    return {
      status: 403,
      code: ADMIN_DELETE_REJECTED_CODE,
      error: ADMIN_DELETE_REJECTED_MESSAGE_EN,
    };
  }

  const freshness = evaluateDeleteImpactFreshness({
    expectedExams: input.expectedExams,
    expectedSubmissions: input.expectedSubmissions,
    actualExams: input.actualExams ?? 0,
    actualSubmissions: input.actualSubmissions ?? 0,
  });
  if (!freshness.ok) {
    return {
      status: 400,
      code: freshness.code,
      error: freshness.error,
    };
  }

  const confirmResult = evaluateDeleteConfirmation({
    confirm: input.confirm,
    expectedToken: input.expectedToken,
    hasProtectedData: input.hasProtectedData,
  });
  if (!confirmResult.ok) {
    return {
      status: 400,
      code: confirmResult.code,
      error: confirmResult.error,
    };
  }

  return { status: 200, schoolId: school.schoolId };
}

function decideBulkDeleteArchivedRequest(input: {
  role: "ADMIN" | "TEACHER" | "STUDENT" | null;
  sessionSchoolId: string | null;
  requestedSchoolId?: string | null;
  confirm?: unknown;
  expectedClasses?: unknown;
  expectedExams?: unknown;
  expectedSubmissions?: unknown;
  actualClasses?: number;
  actualExams?: number;
  actualSubmissions?: number;
}):
  | { status: 403; code: string; error: string }
  | { status: 400; code: string; error: string }
  | { status: 200; schoolId: string } {
  try {
    assertCanAccessSchoolSettings(input.role);
  } catch {
    return {
      status: 403,
      code: ADMIN_DELETE_REJECTED_CODE,
      error: ADMIN_DELETE_REJECTED_MESSAGE_EN,
    };
  }

  const school = tryResolveAdminSchoolId(
    input.sessionSchoolId,
    input.requestedSchoolId,
  );
  if (!school.ok) {
    return {
      status: 403,
      code: ADMIN_DELETE_REJECTED_CODE,
      error: ADMIN_DELETE_REJECTED_MESSAGE_EN,
    };
  }

  const guards = evaluateBulkDeleteArchivedGuards({
    confirm: input.confirm,
    expectedClasses: input.expectedClasses,
    expectedExams: input.expectedExams,
    expectedSubmissions: input.expectedSubmissions,
    actualClasses: input.actualClasses ?? 0,
    actualExams: input.actualExams ?? 0,
    actualSubmissions: input.actualSubmissions ?? 0,
  });
  if (!guards.ok) {
    return {
      status: 400,
      code: guards.code,
      error: guards.error,
    };
  }

  return { status: 200, schoolId: school.schoolId };
}

test("admin delete policy: cross-school request is rejected with opaque copy", () => {
  const result = decideAdminDeleteRequest({
    role: "ADMIN",
    sessionSchoolId: "school_a",
    requestedSchoolId: "school_b",
    confirm: "MATH",
    expectedToken: "MATH",
    hasProtectedData: true,
    expectedExams: 1,
    expectedSubmissions: 0,
    actualExams: 1,
    actualSubmissions: 0,
  });
  assert.deepEqual(result, {
    status: 403,
    code: ADMIN_DELETE_REJECTED_CODE,
    error: ADMIN_DELETE_REJECTED_MESSAGE_EN,
  });
  assert.doesNotMatch(result.error, /school/i);
  assert.doesNotMatch(result.error, /MATH|exist/i);
});

test("admin delete policy: non-admin is rejected with opaque copy", () => {
  for (const role of ["TEACHER", "STUDENT", null] as const) {
    const result = decideAdminDeleteRequest({
      role,
      sessionSchoolId: "school_a",
      requestedSchoolId: "school_a",
      confirm: "MATH",
      expectedToken: "MATH",
      hasProtectedData: true,
    });
    assert.equal(result.status, 403);
    assert.equal(result.error, ADMIN_DELETE_REJECTED_MESSAGE_EN);
  }
});

test("admin delete policy: missing or wrong confirm is rejected when protected", () => {
  const missing = decideAdminDeleteRequest({
    role: "ADMIN",
    sessionSchoolId: "school_a",
    requestedSchoolId: "school_a",
    expectedToken: "MATH",
    hasProtectedData: true,
    expectedExams: 0,
    expectedSubmissions: 0,
  });
  assert.deepEqual(missing, {
    status: 400,
    code: ADMIN_DELETE_REJECTED_CODE,
    error: ADMIN_DELETE_REJECTED_MESSAGE_EN,
  });

  const wrong = decideAdminDeleteRequest({
    role: "ADMIN",
    sessionSchoolId: "school_a",
    confirm: "WRONG",
    expectedToken: "MATH",
    hasProtectedData: true,
    expectedExams: 0,
    expectedSubmissions: 0,
  });
  assert.deepEqual(wrong, {
    status: 400,
    code: ADMIN_DELETE_REJECTED_CODE,
    error: ADMIN_DELETE_REJECTED_MESSAGE_EN,
  });
});

test("admin delete policy: new exam while dialog open is rejected", () => {
  const result = decideAdminDeleteRequest({
    role: "ADMIN",
    sessionSchoolId: "school_a",
    confirm: "MATH",
    expectedToken: "MATH",
    hasProtectedData: false,
    expectedExams: 0,
    expectedSubmissions: 0,
    actualExams: 1,
    actualSubmissions: 0,
  });
  assert.deepEqual(result, {
    status: 400,
    code: ADMIN_DELETE_REJECTED_CODE,
    error: ADMIN_DELETE_REJECTED_MESSAGE_EN,
  });
});

test("admin delete policy: matching confirm and fresh counts succeed", () => {
  const result = decideAdminDeleteRequest({
    role: "ADMIN",
    sessionSchoolId: "school_a",
    requestedSchoolId: "school_a",
    confirm: "MATH",
    expectedToken: "MATH",
    hasProtectedData: true,
    expectedExams: 2,
    expectedSubmissions: 5,
    actualExams: 2,
    actualSubmissions: 5,
  });
  assert.deepEqual(result, { status: 200, schoolId: "school_a" });
});

test("bulk delete_archived: missing or wrong confirm word is rejected", () => {
  const missing = decideBulkDeleteArchivedRequest({
    role: "ADMIN",
    sessionSchoolId: "school_a",
    expectedClasses: 2,
    expectedExams: 1,
    expectedSubmissions: 0,
    actualClasses: 2,
    actualExams: 1,
    actualSubmissions: 0,
  });
  assert.deepEqual(missing, {
    status: 400,
    code: ADMIN_DELETE_REJECTED_CODE,
    error: ADMIN_DELETE_REJECTED_MESSAGE_EN,
  });

  const wrong = decideBulkDeleteArchivedRequest({
    role: "ADMIN",
    sessionSchoolId: "school_a",
    confirm: "DELETE",
    expectedClasses: 2,
    expectedExams: 1,
    expectedSubmissions: 0,
    actualClasses: 2,
    actualExams: 1,
    actualSubmissions: 0,
  });
  assert.deepEqual(wrong, {
    status: 400,
    code: ADMIN_DELETE_REJECTED_CODE,
    error: ADMIN_DELETE_REJECTED_MESSAGE_EN,
  });
});

test("bulk delete_archived: new submission while dialog open is rejected", () => {
  const result = decideBulkDeleteArchivedRequest({
    role: "ADMIN",
    sessionSchoolId: "school_a",
    confirm: ADMIN_BULK_DELETE_ARCHIVED_CONFIRM,
    expectedClasses: 2,
    expectedExams: 1,
    expectedSubmissions: 0,
    actualClasses: 2,
    actualExams: 1,
    actualSubmissions: 2,
  });
  assert.deepEqual(result, {
    status: 400,
    code: ADMIN_DELETE_REJECTED_CODE,
    error: ADMIN_DELETE_REJECTED_MESSAGE_EN,
  });
});

test("bulk delete_archived: cross-school uses same opaque copy as single delete", () => {
  const bulk = decideBulkDeleteArchivedRequest({
    role: "ADMIN",
    sessionSchoolId: "school_a",
    requestedSchoolId: "school_b",
    confirm: ADMIN_BULK_DELETE_ARCHIVED_CONFIRM,
    expectedClasses: 1,
    expectedExams: 0,
    expectedSubmissions: 0,
    actualClasses: 1,
    actualExams: 0,
    actualSubmissions: 0,
  });
  const single = decideAdminDeleteRequest({
    role: "ADMIN",
    sessionSchoolId: "school_a",
    requestedSchoolId: "school_b",
    confirm: "MATH",
    expectedToken: "MATH",
    hasProtectedData: true,
    expectedExams: 0,
    expectedSubmissions: 0,
  });
  assert.deepEqual(bulk, single);
  assert.equal(bulk.error, ADMIN_DELETE_REJECTED_MESSAGE_EN);
  assert.doesNotMatch(bulk.error, /school/i);
});

test("bulk delete_archived: correct confirm and matching counts succeed", () => {
  const result = decideBulkDeleteArchivedRequest({
    role: "ADMIN",
    sessionSchoolId: "school_a",
    requestedSchoolId: "school_a",
    confirm: ADMIN_BULK_DELETE_ARCHIVED_CONFIRM,
    expectedClasses: 3,
    expectedExams: 4,
    expectedSubmissions: 9,
    actualClasses: 3,
    actualExams: 4,
    actualSubmissions: 9,
  });
  assert.deepEqual(result, { status: 200, schoolId: "school_a" });
});
