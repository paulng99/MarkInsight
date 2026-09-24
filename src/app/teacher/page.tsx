import Link from "next/link";
import { TeacherExamList } from "@/components/teacher/exam-list";
import { AppShell } from "@/components/ui/app-shell";
import { Icon } from "@/components/ui/icons";
import {
  getDictionary,
  parseLocale,
  requireRolePage,
} from "@/components/workspace-chrome";

export default async function TeacherPage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string }>;
}) {
  const params = await searchParams;
  const locale = parseLocale(params.locale);
  const t = getDictionary(locale);
  const session = await requireRolePage("TEACHER", locale, "/teacher");
  const user = session.user;
  const displayName = user.name?.trim() || user.email?.split("@")[0] || "";

  return (
    <AppShell user={user} locale={locale} t={t}>
      <section className="role-hero role-hero--teacher animate-fade-up px-6 py-7 sm:px-8 sm:py-9">
        <div aria-hidden className="hero-grid pointer-events-none absolute inset-0 opacity-50" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-100/90">
              {t.teacherShell}
            </p>
            <h1 className="display mt-2 text-2xl sm:text-3xl">
              {t.welcomeBack}
              {displayName ? `, ${displayName}` : ""}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-blue-50/90 sm:text-base">{t.emptyTeacher}</p>
          </div>
          <Link href={`/teacher/exams/new?locale=${locale}`} className="btn btn-inverse">
            <Icon.Plus size={18} />
            {t.examCreate}
          </Link>
        </div>
      </section>

      <TeacherExamList locale={locale} t={t} />
    </AppShell>
  );
}
