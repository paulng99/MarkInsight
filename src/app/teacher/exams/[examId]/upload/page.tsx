import { ProxyUploadForm } from "@/components/teacher/proxy-upload-form";
import { AppShell } from "@/components/ui/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import {
  getDictionary,
  parseLocale,
  requireRolePage,
} from "@/components/workspace-chrome";

export default async function TeacherProxyUploadPage({
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
  const session = await requireRolePage("TEACHER", locale, `/teacher/exams/${examId}/upload`);

  return (
    <AppShell user={session.user} locale={locale} t={t}>
      <PageHeader
        crumbs={[
          { label: t.navDashboard, href: `/teacher?locale=${locale}` },
          { label: t.examDetailTitle, href: `/teacher/exams/${examId}?locale=${locale}` },
          { label: t.proxyUploadTitle },
        ]}
        title={t.proxyUploadTitle}
        description={t.uploadScriptIntro}
      />
      <ProxyUploadForm locale={locale} t={t} examId={examId} />
    </AppShell>
  );
}
