import { TeacherArchive } from "@/components/teacher/teacher-archive";
import { AppShell } from "@/components/ui/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import {
  getDictionary,
  parseLocale,
  requireRolePage,
} from "@/components/workspace-chrome";

export default async function TeacherArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string }>;
}) {
  const params = await searchParams;
  const locale = parseLocale(params.locale);
  const t = getDictionary(locale);
  const session = await requireRolePage("TEACHER", locale, "/teacher/archive");

  return (
    <AppShell user={session.user} locale={locale} t={t}>
      <PageHeader
        crumbs={[
          { label: t.navDashboard, href: `/teacher?locale=${locale}` },
          { label: t.navArchive },
        ]}
        title={t.archiveTitle}
        description={t.archiveIntro}
      />
      <TeacherArchive locale={locale} t={t} />
    </AppShell>
  );
}
