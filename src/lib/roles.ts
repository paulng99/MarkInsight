/** App role union — keep in sync with Prisma `enum Role`. */
export type Role = "ADMIN" | "TEACHER" | "STUDENT";

export const ROLES: Role[] = ["ADMIN", "TEACHER", "STUDENT"];
