import { TeacherExamDetail } from "@/components/teacher/exam-detail";
import {
  WorkspaceHeader,
  getDictionary,
  parseLocale,
  requireRolePage,
} from "@/components/workspace-chrome";

export default async function TeacherExamPage({
  params,
  searchParams,
}: {
  params: Promise<{ examId: string }>;
  searchParams: Promise<{ locale?: string }>;
}) {
  const { examId } = await params;
  const sp = await searchParams;
  const locale = parseLocale(sp.locale);
  const t = getDictionary(locale);
  await requireRolePage("TEACHER", locale, `/teacher/exams/${examId}`);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <WorkspaceHeader
        locale={locale}
        t={t}
        title={t.examDetailTitle}
        basePath={`/teacher/exams/${examId}`}
      />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-[var(--ink)]">
          {t.examDetailTitle}
        </h1>
        <TeacherExamDetail locale={locale} t={t} examId={examId} />
      </main>
    </div>
  );
}
