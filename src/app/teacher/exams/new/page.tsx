import { OpenExamForm } from "@/components/teacher/open-exam-form";
import { AppShell } from "@/components/ui/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import {
  getDictionary,
  parseLocale,
  requireRolePage,
} from "@/components/workspace-chrome";

export default async function TeacherOpenExamPage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string; classSubjectId?: string }>;
}) {
  const params = await searchParams;
  const locale = parseLocale(params.locale);
  const t = getDictionary(locale);
  const session = await requireRolePage("TEACHER", locale, "/teacher/exams/new");

  return (
    <AppShell user={session.user} locale={locale} t={t}>
      <PageHeader
        crumbs={[
          { label: t.navDashboard, href: `/teacher?locale=${locale}` },
          { label: t.openExamTitle },
        ]}
        title={t.openExamTitle}
        description={t.openExamIntro}
      />
      <OpenExamForm
        locale={locale}
        t={t}
        initialClassSubjectId={params.classSubjectId}
      />
    </AppShell>
  );
}
