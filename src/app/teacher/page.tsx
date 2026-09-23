import { RoleShell } from "@/components/role-shell";

export default async function TeacherPage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string }>;
}) {
  return (
    <RoleShell
      role="TEACHER"
      titleKey="teacherShell"
      emptyKey="emptyTeacher"
      searchParams={searchParams}
    />
  );
}
