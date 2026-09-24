import { CrossExamWeaknessView } from "@/components/results/cross-exam-weakness-view";
import { AppShell } from "@/components/ui/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import {
  getDictionary,
  parseLocale,
  requireRolePage,
} from "@/components/workspace-chrome";

export default async function TeacherStudentWeaknessPage({
  params,
  searchParams,
}: {
  params: Promise<{ classSubjectId: string; studentId: string }>;
  searchParams: Promise<{ locale?: string; fromExamId?: string }>;
}) {
  const { classSubjectId, studentId } = await params;
  const sp = await searchParams;
  const locale = parseLocale(sp.locale);
  const t = getDictionary(locale);
  const session = await requireRolePage(
    "TEACHER",
    locale,
    `/teacher/class-subjects/${classSubjectId}/students/${studentId}/weakness`,
  );

  const homeHref = sp.fromExamId
    ? `/teacher/exams/${sp.fromExamId}/results?locale=${locale}`
    : `/teacher?locale=${locale}`;

  const uploadHref = sp.fromExamId
    ? `/teacher/exams/${sp.fromExamId}/upload?locale=${locale}`
    : `/teacher?locale=${locale}`;

  const crumbs = [
    { label: t.navDashboard, href: `/teacher?locale=${locale}` },
    ...(sp.fromExamId ? [{ label: t.classResults, href: homeHref }] : []),
    { label: t.teacherStudentWeakness },
  ];

  return (
    <AppShell user={session.user} locale={locale} t={t}>
      <PageHeader
        crumbs={crumbs}
        title={t.teacherStudentWeakness}
        description={t.crossExamWeaknessIntro}
      />
      <CrossExamWeaknessView
        locale={locale}
        t={t}
        classSubjectId={classSubjectId}
        studentId={studentId}
        role="teacher"
        uploadHref={uploadHref}
        homeHref={homeHref}
      />
    </AppShell>
  );
}
