import { auth } from "@/auth";
import { getDictionary, parseLocale, type Locale } from "@/lib/i18n/dictionaries";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/roles";

export async function requireRolePage(
  role: Role,
  locale: Locale,
  callbackPath: string,
) {
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackPath)}&locale=${locale}`);
  }
  if (session.user.role !== role) {
    redirect(`/?locale=${locale}`);
  }
  return session;
}

export { getDictionary, parseLocale };
