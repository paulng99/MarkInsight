import { RoleShell } from "@/components/role-shell";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string }>;
}) {
  return (
    <RoleShell
      role="ADMIN"
      titleKey="adminShell"
      emptyKey="emptyAdmin"
      searchParams={searchParams}
    />
  );
}
