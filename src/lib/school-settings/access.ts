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

function requireStringSchoolIdOrForbid(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new CrossSchoolAccessError();
  }
  return value;
}

/**
 * Resolve the school an admin may configure from their session.
 * Platform admins with a null schoolId use the demo school stub only.
 * Non-string values are rejected with 403 (never TypeError).
 */
export function schoolIdFromAdminSession(sessionSchoolId: unknown): string {
  const value = requireStringSchoolIdOrForbid(sessionSchoolId);
  if (value?.trim()) return value.trim();
  return DEMO_SCHOOL_ID;
}

/**
 * Resolve the school an admin is configuring.
 * Session school wins; a non-empty requested schoolId must match or we 403.
 * Non-string schoolId values yield 403 instead of TypeError/500.
 */
export function resolveAdminSchoolId(
  sessionSchoolId: unknown,
  requestedSchoolId?: unknown,
): string {
  const schoolId = schoolIdFromAdminSession(sessionSchoolId);
  const requestedRaw = requireStringSchoolIdOrForbid(requestedSchoolId);
  const requested = requestedRaw?.trim();
  if (requested && requested !== schoolId) {
    throw new CrossSchoolAccessError();
  }
  return schoolId;
}

/** Non-throwing form for API routes that prefer a Result over an exception. */
export function tryResolveAdminSchoolId(
  sessionSchoolId: unknown,
  requestedSchoolId?: unknown,
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
