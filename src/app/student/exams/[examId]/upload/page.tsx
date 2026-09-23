import { StudentUploadForm } from "@/components/student/upload-form";
import {
  WorkspaceHeader,
  getDictionary,
  parseLocale,
  requireRolePage,
} from "@/components/workspace-chrome";

export default async function StudentUploadPage({
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
  await requireRolePage("STUDENT", locale, `/student/exams/${examId}/upload`);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <WorkspaceHeader
        locale={locale}
        t={t}
        title={t.uploadScriptTitle}
        basePath={`/student/exams/${examId}/upload`}
      />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
          {t.uploadScriptTitle}
        </h1>
        <p className="mt-3 text-[var(--muted)]">{t.uploadScriptIntro}</p>
        <StudentUploadForm locale={locale} t={t} examId={examId} />
      </main>
    </div>
  );
}
