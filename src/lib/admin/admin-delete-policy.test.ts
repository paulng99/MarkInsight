/**
 * Policy-level coverage for admin delete + school isolation decisions used by
 * `/api/admin/*` routes. Full HTTP route handlers are not exercised here
 * (auth + Prisma would be required); see access.test.ts and delete-confirm.test.ts.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  DELETE_CONFIRM_REQUIRED_CODE,
  evaluateDeleteConfirmation,
} from "./delete-confirm.ts";
import {
  CROSS_SCHOOL_FORBIDDEN_CODE,
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
}):
  | { status: 403; code: string }
  | { status: 400; code: string }
  | { status: 200; schoolId: string } {
  try {
    assertCanAccessSchoolSettings(input.role);
  } catch {
    return { status: 403, code: "forbidden" };
  }

  const school = tryResolveAdminSchoolId(
    input.sessionSchoolId,
    input.requestedSchoolId,
  );
  if (!school.ok) {
    return { status: 403, code: school.code };
  }

  const confirmResult = evaluateDeleteConfirmation({
    confirm: input.confirm,
    expectedToken: input.expectedToken,
    hasProtectedData: input.hasProtectedData,
  });
  if (!confirmResult.ok) {
    return { status: 400, code: confirmResult.code };
  }

  return { status: 200, schoolId: school.schoolId };
}

test("admin delete policy: cross-school request is rejected", () => {
  const result = decideAdminDeleteRequest({
    role: "ADMIN",
    sessionSchoolId: "school_a",
    requestedSchoolId: "school_b",
    confirm: "MATH",
    expectedToken: "MATH",
    hasProtectedData: true,
  });
  assert.deepEqual(result, {
    status: 403,
    code: CROSS_SCHOOL_FORBIDDEN_CODE,
  });
});

test("admin delete policy: non-admin is rejected", () => {
  for (const role of ["TEACHER", "STUDENT", null] as const) {
    const result = decideAdminDeleteRequest({
      role,
      sessionSchoolId: "school_a",
      requestedSchoolId: "school_a",
      confirm: "MATH",
      expectedToken: "MATH",
      hasProtectedData: true,
    });
    assert.deepEqual(result, { status: 403, code: "forbidden" });
  }
});

test("admin delete policy: missing or wrong confirm is rejected when protected", () => {
  const missing = decideAdminDeleteRequest({
    role: "ADMIN",
    sessionSchoolId: "school_a",
    requestedSchoolId: "school_a",
    expectedToken: "MATH",
    hasProtectedData: true,
  });
  assert.deepEqual(missing, {
    status: 400,
    code: DELETE_CONFIRM_REQUIRED_CODE,
  });

  const wrong = decideAdminDeleteRequest({
    role: "ADMIN",
    sessionSchoolId: "school_a",
    confirm: "WRONG",
    expectedToken: "MATH",
    hasProtectedData: true,
  });
  assert.deepEqual(wrong, {
    status: 400,
    code: DELETE_CONFIRM_REQUIRED_CODE,
  });
});

test("admin delete policy: matching confirm succeeds for the session school", () => {
  const result = decideAdminDeleteRequest({
    role: "ADMIN",
    sessionSchoolId: "school_a",
    requestedSchoolId: "school_a",
    confirm: "MATH",
    expectedToken: "MATH",
    hasProtectedData: true,
  });
  assert.deepEqual(result, { status: 200, schoolId: "school_a" });
});
