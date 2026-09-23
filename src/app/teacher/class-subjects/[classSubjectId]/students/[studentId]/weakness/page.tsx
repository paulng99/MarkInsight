import { CrossExamWeaknessView } from "@/components/results/cross-exam-weakness-view";
import {
  WorkspaceHeader,
  getDictionary,
  parseLocale,
  requireRolePage,
} from "@/components/workspace-chrome";

export default async function TeacherStudentWeaknessPage({
  params,
  searchParams,
}: {
  params: Promise<{ classSubjectId: string; studentId: string }>;
  searchParams: Promise<{ locale?: string; fromExamId?: string }>;
}) {
  const { classSubjectId, studentId } = await params;
  const sp = await searchParams;
  const locale = parseLocale(sp.locale);
  const t = getDictionary(locale);
  await requireRolePage(
    "TEACHER",
    locale,
    `/teacher/class-subjects/${classSubjectId}/students/${studentId}/weakness`,
  );

  const homeHref = sp.fromExamId
    ? `/teacher/exams/${sp.fromExamId}/results?locale=${locale}`
    : `/teacher?locale=${locale}`;

  const uploadHref = sp.fromExamId
    ? `/teacher/exams/${sp.fromExamId}/upload?locale=${locale}`
    : `/teacher?locale=${locale}`;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <WorkspaceHeader
        locale={locale}
        t={t}
        title={t.teacherStudentWeakness}
        basePath={`/teacher/class-subjects/${classSubjectId}/students/${studentId}/weakness`}
      />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
          {t.teacherStudentWeakness}
        </h1>
        <p className="mt-3 text-[var(--muted)]">{t.crossExamWeaknessIntro}</p>
        <CrossExamWeaknessView
          locale={locale}
          t={t}
          classSubjectId={classSubjectId}
          studentId={studentId}
          role="teacher"
          uploadHref={uploadHref}
          homeHref={homeHref}
        />
      </main>
    </div>
  );
}
