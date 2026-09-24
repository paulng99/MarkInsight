import { CrossExamWeaknessView } from "@/components/results/cross-exam-weakness-view";
import { AppShell } from "@/components/ui/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import {
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
  const session = await requireRolePage(
    "STUDENT",
    locale,
    `/student/subjects/${classSubjectId}`,
  );

  return (
    <AppShell user={session.user} locale={locale} t={t}>
      <PageHeader
        crumbs={[
          { label: t.navDashboard, href: `/student?locale=${locale}` },
          { label: t.crossExamWeaknessTitle },
        ]}
        title={t.crossExamWeaknessTitle}
        description={t.crossExamWeaknessIntro}
      />
      <CrossExamWeaknessView
        locale={locale}
        t={t}
        classSubjectId={classSubjectId}
        role="student"
        uploadHref={`/student?locale=${locale}`}
        homeHref={`/student?locale=${locale}`}
      />
    </AppShell>
  );
}
