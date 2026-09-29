/**
 * Policy-level coverage for admin delete + school isolation decisions used by
 * `/api/admin/*` routes. Full HTTP route handlers are not exercised here
 * (auth + Prisma would be required); see access.test.ts and delete-confirm.test.ts.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_DELETE_REJECTED_CODE,
  ADMIN_DELETE_REJECTED_MESSAGE_EN,
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
    // Opaque — same copy as other delete rejections (no school leak).
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
