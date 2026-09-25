import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";

type CredentialUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  schoolId: string | null;
};

const DEMO_USERS: CredentialUser[] = [
  {
    id: "demo_admin",
    email: "admin@example.com",
    name: "Demo Admin",
    role: "ADMIN",
    schoolId: null,
  },
  {
    id: "demo_teacher",
    email: "teacher@example.com",
    name: "Demo Teacher",
    role: "TEACHER",
    schoolId: "demo_school",
  },
  {
    id: "demo_student",
    email: "student@example.com",
    name: "Demo Student",
    role: "STUDENT",
    schoolId: "demo_school",
  },
];

const DEMO_PASSWORD = "password";

export async function authorizeCredentials(
  email: string,
  password: string,
): Promise<CredentialUser | null> {
  const normalized = email.toLowerCase().trim();
  if (!normalized || !password) return null;

  const dbUser = await prisma.user.findUnique({ where: { email: normalized } });
  if (dbUser?.passwordHash) {
    const ok = await bcrypt.compare(password, dbUser.passwordHash);
    if (!ok) return null;
    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      schoolId: dbUser.schoolId,
    };
  }

  const demo = DEMO_USERS.find((user) => user.email === normalized);
  if (!demo || password !== DEMO_PASSWORD) return null;
  return demo;
}
