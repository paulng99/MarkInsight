import { StudentExamList } from "@/components/student/exam-list";
import { AppShell } from "@/components/ui/app-shell";
import {
  getDictionary,
  parseLocale,
  requireRolePage,
} from "@/components/workspace-chrome";

export default async function StudentPage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string }>;
}) {
  const params = await searchParams;
  const locale = parseLocale(params.locale);
  const t = getDictionary(locale);
  const session = await requireRolePage("STUDENT", locale, "/student");
  const user = session.user;
  const displayName = user.name?.trim() || user.email?.split("@")[0] || "";

  return (
    <AppShell user={user} locale={locale} t={t}>
      <section className="role-hero role-hero--student animate-fade-up px-6 py-7 sm:px-8 sm:py-9">
        <div aria-hidden className="hero-grid pointer-events-none absolute inset-0 opacity-50" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-50/90">
            {t.studentShell}
          </p>
          <h1 className="display mt-2 text-2xl sm:text-3xl">
            {t.welcomeBack}
            {displayName ? `, ${displayName}` : ""}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-teal-50/90 sm:text-base">{t.emptyStudent}</p>
        </div>
      </section>

      <StudentExamList locale={locale} t={t} />
    </AppShell>
  );
}
