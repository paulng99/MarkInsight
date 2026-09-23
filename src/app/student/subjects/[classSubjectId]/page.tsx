import { CrossExamWeaknessView } from "@/components/results/cross-exam-weakness-view";
import {
  WorkspaceHeader,
  getDictionary,
  parseLocale,
  requireRolePage,
} from "@/components/workspace-chrome";

export default async function StudentSubjectWeaknessPage({
  params,
  searchParams,
}: {
  params: Promise<{ classSubjectId: string }>;
  searchParams: Promise<{ locale?: string }>;
}) {
  const { classSubjectId } = await params;
  const sp = await searchParams;
  const locale = parseLocale(sp.locale);
  const t = getDictionary(locale);
  await requireRolePage(
    "STUDENT",
    locale,
    `/student/subjects/${classSubjectId}`,
  );

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <WorkspaceHeader
        locale={locale}
        t={t}
        title={t.crossExamWeaknessTitle}
        basePath={`/student/subjects/${classSubjectId}`}
      />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
          {t.crossExamWeaknessTitle}
        </h1>
        <p className="mt-3 text-[var(--muted)]">{t.crossExamWeaknessIntro}</p>
        <CrossExamWeaknessView
          locale={locale}
          t={t}
          classSubjectId={classSubjectId}
          role="student"
          uploadHref={`/student?locale=${locale}`}
          homeHref={`/student?locale=${locale}`}
        />
      </main>
    </div>
  );
}
