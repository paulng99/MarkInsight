import { StudentResultView } from "@/components/student/result-view";
import {
  WorkspaceHeader,
  getDictionary,
  parseLocale,
  requireRolePage,
} from "@/components/workspace-chrome";

export default async function StudentSubmissionPage({
  params,
  searchParams,
}: {
  params: Promise<{ submissionId: string }>;
  searchParams: Promise<{ locale?: string }>;
}) {
  const { submissionId } = await params;
  const sp = await searchParams;
  const locale = parseLocale(sp.locale);
  const t = getDictionary(locale);
  await requireRolePage(
    "STUDENT",
    locale,
    `/student/submissions/${submissionId}`,
  );

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <WorkspaceHeader
        locale={locale}
        t={t}
        title={t.resultsTitle}
        basePath={`/student/submissions/${submissionId}`}
      />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
          {t.resultsTitle}
        </h1>
        <p className="mt-3 text-[var(--muted)]">{t.resultsIntro}</p>
        <StudentResultView locale={locale} t={t} submissionId={submissionId} />
      </main>
    </div>
  );
}
