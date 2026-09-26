"use server";

import { signIn, signOut } from "@/auth";
import { rememberPublicAuthOrigin } from "@/lib/auth/public-origin";
import { homePathForRole } from "@/lib/rbac";
import type { Role } from "@/lib/roles";
import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

function roleFromDemoEmail(email: string): Role {
  const normalized = email.toLowerCase().trim();
  if (normalized === "admin@example.com") return "ADMIN";
  if (normalized === "teacher@example.com") return "TEACHER";
  return "STUDENT";
}

export async function loginAction(formData: FormData) {
  rememberPublicAuthOrigin(await headers());
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const locale = String(formData.get("locale") ?? "zh-HK");
  const redirectTo = homePathForRole(roleFromDemoEmail(email));

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo,
    });
  } catch (error) {
    // Next.js redirect() throws; rethrow so navigation works.
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    if (error instanceof AuthError) {
      redirect(
        `/login?locale=${encodeURIComponent(locale)}&error=${encodeURIComponent(error.type)}`,
      );
    }
    throw error;
  }
}

export async function logoutAction(formData: FormData) {
  rememberPublicAuthOrigin(await headers());
  const locale = String(formData.get("locale") ?? "zh-HK");
  await signOut({ redirectTo: `/?locale=${encodeURIComponent(locale)}` });
}
