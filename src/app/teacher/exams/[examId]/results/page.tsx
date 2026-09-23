import { TeacherClassResults } from "@/components/teacher/class-results";
import {
  WorkspaceHeader,
  getDictionary,
  parseLocale,
  requireRolePage,
} from "@/components/workspace-chrome";

export default async function TeacherResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ examId: string }>;
  searchParams: Promise<{ locale?: string; submissionId?: string }>;
}) {
  const { examId } = await params;
  const sp = await searchParams;
  const locale = parseLocale(sp.locale);
  const t = getDictionary(locale);
  await requireRolePage("TEACHER", locale, `/teacher/exams/${examId}/results`);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <WorkspaceHeader
        locale={locale}
        t={t}
        title={t.resultsTitle}
        basePath={`/teacher/exams/${examId}/results`}
      />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
          {t.resultsTitle}
        </h1>
        <p className="mt-3 text-[var(--muted)]">{t.resultsIntro}</p>
        <TeacherClassResults
          locale={locale}
          t={t}
          examId={examId}
          initialSubmissionId={sp.submissionId}
        />
      </main>
    </div>
  );
}
