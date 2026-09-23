import { auth } from "@/auth";
import { logoutAction } from "@/app/login/actions";
import {
  getDictionary,
  parseLocale,
  type Locale,
} from "@/lib/i18n/dictionaries";
import Link from "next/link";
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

export function WorkspaceHeader({
  locale,
  t,
  title,
  basePath,
}: {
  locale: Locale;
  t: ReturnType<typeof getDictionary>;
  title: string;
  basePath: string;
}) {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-baseline gap-3">
          <Link
            href={`/?locale=${locale}`}
            className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--brand)]"
          >
            {t.brand}
          </Link>
          <span className="text-sm text-[var(--muted)]">{title}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-2 text-sm">
            <Link
              href={`${basePath}?locale=zh-HK`}
              className={
                locale === "zh-HK"
                  ? "font-semibold text-[var(--brand)]"
                  : "text-[var(--muted)]"
              }
            >
              繁
            </Link>
            <span className="text-[var(--border)]">|</span>
            <Link
              href={`${basePath}?locale=en`}
              className={
                locale === "en"
                  ? "font-semibold text-[var(--brand)]"
                  : "text-[var(--muted)]"
              }
            >
              EN
            </Link>
          </div>
          <form action={logoutAction}>
            <input type="hidden" name="locale" value={locale} />
            <button
              type="submit"
              className="text-sm font-medium text-[var(--brand-deep)] hover:underline"
            >
              {t.signOut}
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

export { getDictionary, parseLocale };
