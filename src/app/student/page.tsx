import { RoleShell } from "@/components/role-shell";

export default async function StudentPage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string }>;
}) {
  return (
    <RoleShell
      role="STUDENT"
      titleKey="studentShell"
      emptyKey="emptyStudent"
      searchParams={searchParams}
    />
  );
}
