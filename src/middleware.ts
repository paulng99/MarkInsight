import { auth } from "@/auth";
import { homePathForRole } from "@/lib/rbac";
import { NextResponse } from "next/server";

const roleGuards: Record<string, string> = {
  "/admin": "ADMIN",
  "/teacher": "TEACHER",
  "/student": "STUDENT",
};

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const guard = Object.entries(roleGuards).find(
    ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!guard) {
    return NextResponse.next();
  }

  const [, requiredRole] = guard;
  const session = req.auth;

  if (!session?.user) {
    const login = new URL("/login", req.nextUrl.origin);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  if (session.user.role !== requiredRole) {
    return NextResponse.redirect(
      new URL(homePathForRole(session.user.role), req.nextUrl.origin),
    );
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/teacher/:path*", "/student/:path*"],
};
