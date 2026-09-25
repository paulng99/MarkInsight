import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { Role } from "@/lib/roles";
import { homePathForRole } from "@/lib/rbac";

/**
 * Credentials auth. Registered users are checked against Prisma passwordHash.
 * Demo accounts still sign in with password "password" before the database row exists.
 */

declare module "next-auth" {
  interface User {
    role: Role;
    schoolId: string | null;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: Role;
      schoolId: string | null;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    schoolId: string | null;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toString() ?? "";
        const password = credentials?.password?.toString() ?? "";
        const { authorizeCredentials } = await import("@/lib/auth/credentials");
        const match = await authorizeCredentials(email, password);
        if (!match) return null;
        return {
          id: match.id,
          email: match.email,
          name: match.name ?? undefined,
          role: match.role,
          schoolId: match.schoolId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.schoolId = user.schoolId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.schoolId = token.schoolId;
        if (token.email) session.user.email = token.email;
        if (token.name !== undefined) session.user.name = token.name;
      }
      return session;
    },
  },
});

export { homePathForRole };
