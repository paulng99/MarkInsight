/**
 * Pure admin access helpers (no Prisma). Used by /api/admin/* routes.
 */

import type { Role } from "../roles";

/** Stub/demo school used when platform admin has no schoolId. */
export const DEMO_SCHOOL_ID = "demo_school";

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
 * Resolve the school an admin is configuring.
 * Platform admins (schoolId null) manage the demo school in the stub.
 *
 * Note: a non-null `requestedSchoolId` currently wins over the session school.
 * Callers that need cross-school rejection must add that check separately.
 */
export function resolveAdminSchoolId(
  sessionSchoolId: string | null | undefined,
  requestedSchoolId?: string | null,
): string {
  if (requestedSchoolId?.trim()) return requestedSchoolId.trim();
  if (sessionSchoolId?.trim()) return sessionSchoolId.trim();
  return DEMO_SCHOOL_ID;
}
