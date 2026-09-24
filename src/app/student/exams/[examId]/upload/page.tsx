import { StudentUploadForm } from "@/components/student/upload-form";
import { AppShell } from "@/components/ui/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import {
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
  const session = await requireRolePage("STUDENT", locale, `/student/exams/${examId}/upload`);

  return (
    <AppShell user={session.user} locale={locale} t={t}>
      <PageHeader
        crumbs={[
          { label: t.navDashboard, href: `/student?locale=${locale}` },
          { label: t.uploadScriptTitle },
        ]}
        title={t.uploadScriptTitle}
        description={t.uploadScriptIntro}
      />
      <StudentUploadForm locale={locale} t={t} examId={examId} />
    </AppShell>
  );
}
