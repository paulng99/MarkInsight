import { TeacherClassResults } from "@/components/teacher/class-results";
import { AppShell } from "@/components/ui/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import {
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
  const session = await requireRolePage("TEACHER", locale, `/teacher/exams/${examId}/results`);

  return (
    <AppShell user={session.user} locale={locale} t={t}>
      <PageHeader
        crumbs={[
          { label: t.navDashboard, href: `/teacher?locale=${locale}` },
          { label: t.examDetailTitle, href: `/teacher/exams/${examId}?locale=${locale}` },
          { label: t.classResults },
        ]}
        title={t.classResults}
        description={t.resultsIntro}
      />
      <TeacherClassResults
        locale={locale}
        t={t}
        examId={examId}
        initialSubmissionId={sp.submissionId}
      />
    </AppShell>
  );
}
