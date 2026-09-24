import { OpenExamForm } from "@/components/teacher/open-exam-form";
import {
  WorkspaceHeader,
  getDictionary,
  parseLocale,
  requireRolePage,
} from "@/components/workspace-chrome";
import Link from "next/link";

export default async function TeacherOpenExamPage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string; classSubjectId?: string }>;
}) {
  const params = await searchParams;
  const locale = parseLocale(params.locale);
  const t = getDictionary(locale);
  await requireRolePage("TEACHER", locale, "/teacher/exams/new");

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <WorkspaceHeader
        locale={locale}
        t={t}
        title={t.openExamTitle}
        basePath="/teacher/exams/new"
      />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-[var(--ink)]">
          {t.openExamTitle}
        </h1>
        <p className="mt-3 max-w-2xl text-base text-[var(--muted)]">
          {t.openExamIntro}
        </p>
        <OpenExamForm
          locale={locale}
          t={t}
          initialClassSubjectId={params.classSubjectId}
        />
        <Link
          href={`/teacher?locale=${locale}`}
          className="mt-10 text-sm text-[var(--muted)] hover:underline"
        >
          {t.examBack}
        </Link>
      </main>
    </div>
  );
}
