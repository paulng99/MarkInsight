import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDictionary, parseLocale } from "@/lib/i18n/dictionaries";
import { homePathForRole } from "@/lib/rbac";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Icon } from "@/components/ui/icons";
import { LocaleSwitch } from "@/components/ui/locale-switch";
import { Alert } from "@/components/ui/feedback";
import { registerAction } from "./actions";
import { RegisterForm } from "@/components/auth/register-form";

function errorMessage(
  code: string | undefined,
  t: ReturnType<typeof getDictionary>,
): string | null {
  if (!code) return null;
  if (code === "no_invite") return t.registerErrorNoInvite;
  if (code === "account_exists") return t.registerErrorExists;
  if (code === "invalid_password" || code === "password") return t.registerErrorPassword;
  if (code === "mismatch") return t.registerErrorMismatch;
  if (code === "invalid_name") return t.registerErrorName;
  if (code === "invalid_email") return t.rosterRejectedInvalid;
  return t.registerErrorGeneric;
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string; error?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const locale = parseLocale(params.locale);
  const t = getDictionary(locale);

  if (session?.user) {
    redirect(`${homePathForRole(session.user.role)}?locale=${locale}`);
  }

  return (
    <div className="page-bg flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <BrandLogo href={`/?locale=${locale}`} />
        <div className="flex items-center gap-2">
          <Suspense fallback={null}>
            <LocaleSwitch locale={locale} />
          </Suspense>
          <Link href={`/login?locale=${locale}`} className="btn btn-ghost btn-sm">
            <Icon.ArrowLeft size={16} />
            {t.submit}
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-5 pb-16 pt-6 sm:px-8">
        <div className="card animate-fade-up w-full max-w-md p-6 sm:p-8">
          <p className="eyebrow">{t.brand}</p>
          <h1 className="display mt-2 text-3xl text-[var(--ink)]">{t.registerTitle}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{t.registerSubtitle}</p>
          {errorMessage(params.error, t) ? (
            <div className="mt-6">
              <Alert tone="error">{errorMessage(params.error, t)}</Alert>
            </div>
          ) : null}
          <div className="mt-8">
            <RegisterForm action={registerAction} locale={locale} t={t} />
          </div>
          <p className="mt-6 text-center text-sm text-[var(--muted)]">
            {t.registerHaveAccount}{" "}
            <Link href={`/login?locale=${locale}`} className="link font-semibold">
              {t.submit}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
