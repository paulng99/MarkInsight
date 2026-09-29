import bcrypt from "bcryptjs";
import {
  getDemoLoginPolicy,
  matchDemoStubCredentials,
  type DemoLoginPolicy,
} from "@/lib/auth/demo-login-policy";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";

export type CredentialUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  schoolId: string | null;
};

type DbCredentialUser = CredentialUser & {
  passwordHash: string | null;
};

export type AuthorizeCredentialsDeps = {
  findUserByEmail?: (email: string) => Promise<DbCredentialUser | null>;
  getPolicy?: () => DemoLoginPolicy;
  comparePassword?: (password: string, hash: string) => Promise<boolean>;
};

export async function authorizeCredentials(
  email: string,
  password: string,
  deps: AuthorizeCredentialsDeps = {},
): Promise<CredentialUser | null> {
  const normalized = email.toLowerCase().trim();
  if (!normalized || !password) return null;

  const findUser =
    deps.findUserByEmail ??
    (async (addr) => {
      const dbUser = await prisma.user.findUnique({ where: { email: addr } });
      if (!dbUser) return null;
      return {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
        schoolId: dbUser.schoolId,
        passwordHash: dbUser.passwordHash,
      };
    });
  const resolvePolicy = deps.getPolicy ?? getDemoLoginPolicy;
  const compare =
    deps.comparePassword ?? ((pw, hash) => bcrypt.compare(pw, hash));

  const dbUser = await findUser(normalized);
  if (dbUser?.passwordHash) {
    const ok = await compare(password, dbUser.passwordHash);
    if (!ok) return null;
    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      schoolId: dbUser.schoolId,
    };
  }

  return matchDemoStubCredentials(normalized, password, resolvePolicy());
}
