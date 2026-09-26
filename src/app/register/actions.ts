"use server";

import { signIn } from "@/auth";
import { rememberPublicAuthOrigin } from "@/lib/auth/public-origin";
import { registerInvitedStudent } from "@/lib/enrollments/roster";
import { AppError } from "@/lib/errors";
import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

function registerErrorCode(error: unknown): string {
  if (error instanceof AppError) return error.code;
  return "generic";
}

export async function registerAction(formData: FormData) {
  rememberPublicAuthOrigin(await headers());
  const locale = String(formData.get("locale") ?? "zh-HK");
  const email = String(formData.get("email") ?? "");
  const name = String(formData.get("name") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const fail = (code: string) => {
    redirect(`/register?locale=${encodeURIComponent(locale)}&error=${encodeURIComponent(code)}`);
  };

  if (password !== confirm) fail("mismatch");
  if (password.length < 8) fail("password");

  try {
    await registerInvitedStudent({ email, name, password });
  } catch (error) {
    fail(registerErrorCode(error));
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: `/student?locale=${encodeURIComponent(locale)}`,
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    if (error instanceof AuthError) {
      redirect(`/login?locale=${encodeURIComponent(locale)}&error=CredentialsSignin`);
    }
    throw error;
  }
}
