import { TeacherExamDetail } from "@/components/teacher/exam-detail";
import { AppShell } from "@/components/ui/app-shell";
import {
  getDictionary,
  parseLocale,
  requireRolePage,
} from "@/components/workspace-chrome";

export default async function TeacherExamPage({
  params,
  searchParams,
}: {
  params: Promise<{ examId: string }>;
  searchParams: Promise<{ locale?: string }>;
}) {
  const { examId } = await params;
  const sp = await searchParams;
  const locale = parseLocale(sp.locale);
  const t = getDictionary(locale);
  const session = await requireRolePage("TEACHER", locale, `/teacher/exams/${examId}`);

  return (
    <AppShell user={session.user} locale={locale} t={t}>
      <TeacherExamDetail locale={locale} t={t} examId={examId} />
    </AppShell>
  );
}
