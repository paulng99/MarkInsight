import { AppShell } from "@/components/ui/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { AdminSubjectsManager } from "@/components/admin/admin-subjects-manager";
import {
  getDictionary,
  parseLocale,
  requireRolePage,
} from "@/components/workspace-chrome";
import { resolveAdminSchoolId } from "@/lib/school-settings";

export default async function AdminSubjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string; schoolId?: string }>;
}) {
  const params = await searchParams;
  const locale = parseLocale(params.locale);
  const t = getDictionary(locale);
  const session = await requireRolePage("ADMIN", locale, "/admin/subjects");
  // School scope follows the signed-in admin only (ignore URL schoolId).
  const schoolId = resolveAdminSchoolId(session.user.schoolId);

  return (
    <AppShell user={session.user} locale={locale} t={t}>
      <PageHeader
        crumbs={[
          { label: t.navOverview, href: `/admin?locale=${locale}` },
          { label: t.adminSubjectsTitle },
        ]}
        title={t.adminSubjectsTitle}
        description={t.adminSubjectsIntro}
      />
      <AdminSubjectsManager locale={locale} t={t} schoolId={schoolId} />
    </AppShell>
  );
}
