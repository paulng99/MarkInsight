import { TeacherExamList } from "@/components/teacher/exam-list";
import {
  WorkspaceHeader,
  getDictionary,
  parseLocale,
  requireRolePage,
} from "@/components/workspace-chrome";
import Link from "next/link";

export default async function TeacherPage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string }>;
}) {
  const params = await searchParams;
  const locale = parseLocale(params.locale);
  const t = getDictionary(locale);
  const session = await requireRolePage("TEACHER", locale, "/teacher");

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <WorkspaceHeader
        locale={locale}
        t={t}
        title={t.teacherShell}
        basePath="/teacher"
      />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12">
        <p className="text-sm text-[var(--muted)]">
          {session.user.email} · {session.user.role}
        </p>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-semibold text-[var(--ink)]">
          {t.teacherShell}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--muted)]">
          {t.emptyTeacher}
        </p>
        <TeacherExamList locale={locale} t={t} />
        <Link
          href={`/?locale=${locale}`}
          className="mt-10 text-sm font-medium text-[var(--brand)] hover:underline"
        >
          {t.backHome}
        </Link>
      </main>
    </div>
  );
}
