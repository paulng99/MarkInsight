import { SchoolSettingsForm } from "@/components/admin/school-settings-form";
import { AppShell } from "@/components/ui/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import {
  getDictionary,
  parseLocale,
  requireRolePage,
} from "@/components/workspace-chrome";
import {
  getSchoolSettingsPage,
  resolveAdminSchoolId,
} from "@/lib/school-settings";
import type { SchoolSettingsPageDto } from "@/lib/school-settings/types";

/**
 * Admin school settings — single page, one save.
 * Never surface API keys or vendor brand names in the UI.
 * Teachers/students are blocked by middleware (ADMIN only).
 */
export default async function AdminSchoolSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string; schoolId?: string }>;
}) {
  const params = await searchParams;
  const locale = parseLocale(params.locale);
  const t = getDictionary(locale);
  const session = await requireRolePage("ADMIN", locale, "/admin/settings");

  const schoolId = resolveAdminSchoolId(
    session.user.schoolId,
    params.schoolId,
  );

  let initialPage: SchoolSettingsPageDto | null = null;
  let initialError: string | null = null;
  try {
    initialPage = await getSchoolSettingsPage(schoolId);
  } catch (error) {
    initialError =
      error instanceof Error ? error.message : t.settingsErrorLoad;
  }

  return (
    <AppShell user={session.user} locale={locale} t={t}>
      <PageHeader
        crumbs={[
          { label: t.navOverview, href: `/admin?locale=${locale}` },
          { label: t.settingsTitle },
        ]}
        title={t.settingsTitle}
        description={t.settingsIntro}
      />
      <SchoolSettingsForm
        locale={locale}
        t={t}
        initialPage={initialPage}
        initialError={initialError}
      />
    </AppShell>
  );
}
