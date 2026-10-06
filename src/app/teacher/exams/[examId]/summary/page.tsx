import { TeacherClassExamSummary } from "@/components/teacher/class-exam-summary";
import { AppShell } from "@/components/ui/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import {
  getDictionary,
  parseLocale,
  requireRolePage,
} from "@/components/workspace-chrome";

export default async function TeacherClassExamSummaryPage({
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
  const session = await requireRolePage(
    "TEACHER",
    locale,
    `/teacher/exams/${examId}/summary`,
  );

  return (
    <AppShell user={session.user} locale={locale} t={t}>
      <PageHeader
        crumbs={[
          { label: t.navDashboard, href: `/teacher?locale=${locale}` },
          { label: t.examDetailTitle, href: `/teacher/exams/${examId}?locale=${locale}` },
          { label: t.classResults, href: `/teacher/exams/${examId}/results?locale=${locale}` },
          { label: t.classExamSummaryTitle },
        ]}
        title={t.classExamSummaryTitle}
        description={t.classExamSummaryIntro}
      />
      <TeacherClassExamSummary locale={locale} t={t} examId={examId} />
    </AppShell>
  );
}
