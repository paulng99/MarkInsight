import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import {
  authCookiesAreSecure,
  preferRequestHostForLoopbackAuthUrl,
  readAuthSecret,
  rememberPublicAuthOrigin,
} from "@/lib/auth/public-origin";
import type { Role } from "@/lib/roles";
import { homePathForRole } from "@/lib/rbac";

preferRequestHostForLoopbackAuthUrl();

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

export const { handlers, auth, signIn, signOut } = NextAuth((request) => {
  preferRequestHostForLoopbackAuthUrl();
  if (request) rememberPublicAuthOrigin(request.headers);
  const secret = readAuthSecret();
  if (!secret) {
    console.error(
      "[auth] AUTH_SECRET is missing. /api/auth responds with: There was a problem with the server configuration.",
    );
  }
  return {
    trustHost: true,
    secret,
    useSecureCookies: authCookiesAreSecure(),
    session: { strategy: "jwt" },
    logger: {
      error(error) {
        console.error("[auth]", error);
      },
      warn(code) {
        console.warn("[auth]", code);
      },
    },
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
  };
});

export { homePathForRole };
