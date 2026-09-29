/**
 * Admin school access helpers.
 *
 * School scope always comes from the signed-in admin's session.
 * A request schoolId that differs from the session school is rejected (403).
 * There is no multi-school super-admin path — a null session schoolId only
 * falls back to the local demo school stub.
 */

import type { Role } from "../roles";

/** Stub/demo school used when platform admin has no schoolId. */
export const DEMO_SCHOOL_ID = "demo_school";

export const CROSS_SCHOOL_FORBIDDEN_CODE = "cross_school_forbidden";
/** Opaque — must not reveal whether a resource exists in another school. */
export const CROSS_SCHOOL_FORBIDDEN_MESSAGE = "Forbidden";

export class CrossSchoolAccessError extends Error {
  readonly status = 403 as const;
  readonly code = CROSS_SCHOOL_FORBIDDEN_CODE;

  constructor(message = CROSS_SCHOOL_FORBIDDEN_MESSAGE) {
    super(message);
    this.name = "CrossSchoolAccessError";
  }
}

export function canAccessSchoolSettings(role: Role | undefined | null): boolean {
  return role === "ADMIN";
}

export function assertCanAccessSchoolSettings(
  role: Role | undefined | null,
): void {
  if (!canAccessSchoolSettings(role)) {
    throw new Error("Forbidden: school settings are admin-only");
  }
}

/**
 * Resolve the school an admin may configure from their session.
 * Platform admins with a null schoolId use the demo school stub only.
 */
export function schoolIdFromAdminSession(
  sessionSchoolId: string | null | undefined,
): string {
  if (sessionSchoolId?.trim()) return sessionSchoolId.trim();
  return DEMO_SCHOOL_ID;
}

/**
 * Resolve the school an admin is configuring.
 * Session school wins; a non-empty requested schoolId must match or we 403.
 */
export function resolveAdminSchoolId(
  sessionSchoolId: string | null | undefined,
  requestedSchoolId?: string | null,
): string {
  const schoolId = schoolIdFromAdminSession(sessionSchoolId);
  const requested = requestedSchoolId?.trim();
  if (requested && requested !== schoolId) {
    throw new CrossSchoolAccessError();
  }
  return schoolId;
}

/** Non-throwing form for API routes that prefer a Result over an exception. */
export function tryResolveAdminSchoolId(
  sessionSchoolId: string | null | undefined,
  requestedSchoolId?: string | null,
):
  | { ok: true; schoolId: string }
  | { ok: false; status: 403; error: string; code: string } {
  try {
    return {
      ok: true,
      schoolId: resolveAdminSchoolId(sessionSchoolId, requestedSchoolId),
    };
  } catch (error) {
    if (error instanceof CrossSchoolAccessError) {
      return {
        ok: false,
        status: 403,
        error: error.message,
        code: error.code,
      };
    }
    throw error;
  }
}
