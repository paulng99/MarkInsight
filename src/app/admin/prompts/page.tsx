import { SystemPromptsForm } from "@/components/admin/system-prompts-form";
import { AppShell } from "@/components/ui/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import {
  getDictionary,
  parseLocale,
  requireRolePage,
} from "@/components/workspace-chrome";
import { listSystemPrompts } from "@/lib/llm/system-prompts";
import { resolveAdminSchoolId } from "@/lib/school-settings";

export default async function AdminSystemPromptsPage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string; schoolId?: string }>;
}) {
  const params = await searchParams;
  const locale = parseLocale(params.locale);
  const t = getDictionary(locale);
  const session = await requireRolePage("ADMIN", locale, "/admin/prompts");
  const schoolId = resolveAdminSchoolId(session.user.schoolId, params.schoolId);
  const prompts = await listSystemPrompts(schoolId);

  return (
    <AppShell user={session.user} locale={locale} t={t}>
      <PageHeader
        crumbs={[
          { label: t.navOverview, href: `/admin?locale=${locale}` },
          { label: t.settingsSectionPrompts },
        ]}
        title={t.settingsSectionPrompts}
        description={t.settingsSectionPromptsHelp}
      />
      <SystemPromptsForm
        locale={locale}
        t={t}
        schoolId={schoolId}
        initialPrompts={prompts}
      />
    </AppShell>
  );
}
