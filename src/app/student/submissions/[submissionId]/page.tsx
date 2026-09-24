import { StudentResultView } from "@/components/student/result-view";
import { AppShell } from "@/components/ui/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import {
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
  const session = await requireRolePage(
    "STUDENT",
    locale,
    `/student/submissions/${submissionId}`,
  );

  return (
    <AppShell user={session.user} locale={locale} t={t}>
      <PageHeader
        crumbs={[
          { label: t.navDashboard, href: `/student?locale=${locale}` },
          { label: t.resultsTitle },
        ]}
        title={t.resultsTitle}
        description={t.resultsIntro}
      />
      <StudentResultView locale={locale} t={t} submissionId={submissionId} />
    </AppShell>
  );
}
