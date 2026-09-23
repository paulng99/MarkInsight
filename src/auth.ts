import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { Role } from "@/lib/roles";
import { homePathForRole } from "@/lib/rbac";

/**
 * Auth shell — credentials stub for local/demo.
 *
 * TODO: Replace DEMO_USERS with Prisma User + passwordHash (bcrypt).
 * TODO: Optionally add email magic-link / OAuth; not required for MVP scaffold.
 * TODO: Persist sessions / link schoolId from DB for real RBAC.
 */

type DemoUser = {
  id: string;
  email: string;
  name: string;
  password: string;
  role: Role;
  schoolId: string | null;
};

const DEMO_USERS: DemoUser[] = [
  {
    id: "demo_admin",
    email: "admin@example.com",
    name: "Demo Admin",
    password: "password",
    role: "ADMIN",
    schoolId: null,
  },
  {
    id: "demo_teacher",
    email: "teacher@example.com",
    name: "Demo Teacher",
    password: "password",
    role: "TEACHER",
    schoolId: "demo_school",
  },
  {
    id: "demo_student",
    email: "student@example.com",
    name: "Demo Student",
    password: "password",
    role: "STUDENT",
    schoolId: "demo_school",
  },
];

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
        const email = credentials?.email?.toString().toLowerCase().trim();
        const password = credentials?.password?.toString() ?? "";
        if (!email || !password) return null;

        const match = DEMO_USERS.find(
          (u) => u.email === email && u.password === password,
        );
        if (!match) return null;

        return {
          id: match.id,
          email: match.email,
          name: match.name,
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
