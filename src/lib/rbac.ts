import type { Role } from "@/lib/roles";

/**
 * Role helpers for MarkInsight RBAC.
 *
 * TODO: Enforce schoolId on every server query/mutation.
 * TODO: Teachers/students may only access rows linked via Enrollment / own Submission.
 * TODO: Admin may create School + teacher User accounts only — no teaching workspace APIs.
 */

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
  schoolId: string | null;
};

export function isAdmin(user: SessionUser | null | undefined): boolean {
  return user?.role === "ADMIN";
}

export function isTeacher(user: SessionUser | null | undefined): boolean {
  return user?.role === "TEACHER";
}

export function isStudent(user: SessionUser | null | undefined): boolean {
  return user?.role === "STUDENT";
}

export function assertSameSchool(user: SessionUser, schoolId: string): void {
  if (user.role === "ADMIN" && user.schoolId == null) {
    // Platform admin (no school) — school creation flows only; still no cross-tenant data reads.
    return;
  }
  if (user.schoolId !== schoolId) {
    throw new Error("RBAC: school tenant mismatch");
  }
}

/** Maps Role → default app shell path after sign-in. */
export function homePathForRole(role: Role): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "TEACHER":
      return "/teacher";
    case "STUDENT":
      return "/student";
    default:
      return "/";
  }
}
