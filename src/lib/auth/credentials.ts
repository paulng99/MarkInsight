import bcrypt from "bcryptjs";
import {
  DEMO_STUB_USERS,
  getDemoLoginPolicy,
  matchDemoStubCredentials,
  type DemoLoginPolicy,
} from "./demo-login-policy";
import type { Role } from "../roles";

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

const DEMO_EMAILS = new Set(
  DEMO_STUB_USERS.map((user) => user.email.toLowerCase()),
);
const DEMO_IDS = new Set(DEMO_STUB_USERS.map((user) => user.id));

/**
 * Reserved local-demo identities. When demo login policy is disabled these
 * must never authenticate — even if a leftover DB row still has passwordHash.
 */
export function isReservedDemoIdentity(user: {
  id: string;
  email: string;
}): boolean {
  const email = user.email.toLowerCase().trim();
  return DEMO_EMAILS.has(email) || DEMO_IDS.has(user.id);
}

async function findUserFromPrisma(addr: string): Promise<DbCredentialUser | null> {
  const { prisma } = await import("../prisma");
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
}

export async function authorizeCredentials(
  email: string,
  password: string,
  deps: AuthorizeCredentialsDeps = {},
): Promise<CredentialUser | null> {
  const normalized = email.toLowerCase().trim();
  if (!normalized || !password) return null;

  const findUser = deps.findUserByEmail ?? findUserFromPrisma;
  const resolvePolicy = deps.getPolicy ?? getDemoLoginPolicy;
  const compare =
    deps.comparePassword ?? ((pw, hash) => bcrypt.compare(pw, hash));

  const policy = resolvePolicy();
  const dbUser = await findUser(normalized);
  if (dbUser?.passwordHash) {
    // Public / non-demo deploys: leftover demo rows must not accept "password".
    if (!policy.enabled && isReservedDemoIdentity(dbUser)) {
      return null;
    }
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

  return matchDemoStubCredentials(normalized, password, policy);
}
