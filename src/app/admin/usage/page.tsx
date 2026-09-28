import type { ReactNode } from "react";
import Link from "next/link";
import { AppShell } from "@/components/ui/app-shell";
import { Icon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import {
  getDictionary,
  parseLocale,
  requireRolePage,
} from "@/components/workspace-chrome";
import {
  formatTokenCount,
  formatUsd,
  getAnalysisUsagePage,
  resolveUsageSchoolYear,
  USAGE_RANGE_PRESETS,
  usagePresetRange,
  type UsageJobRow,
  type UsageRangePreset,
  type UsageRollup,
  type UsageSchoolNode,
} from "@/lib/admin/analysis-usage";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import type { AnalysisJobKind, AnalysisJobStatus } from "@prisma/client";

const statusBadge: Record<AnalysisJobStatus, string> = {
  PENDING: "badge-neutral",
  RUNNING: "badge-info",
  SUCCEEDED: "badge-success",
  FAILED: "badge-error",
};

function statusLabel(status: AnalysisJobStatus, t: Dictionary) {
  switch (status) {
    case "PENDING":
      return t.jobStatusPending;
    case "RUNNING":
      return t.jobStatusRunning;
    case "SUCCEEDED":
      return t.jobStatusSucceeded;
    case "FAILED":
      return t.jobStatusFailed;
  }
}

function rangePresetLabel(id: UsageRangePreset, t: Dictionary) {
  switch (id) {
    case "today":
      return t.usageRangeToday;
    case "yesterday":
      return t.usageRangeYesterday;
    case "last3":
      return t.usageRangeLast3;
    case "thisMonth":
      return t.usageRangeThisMonth;
    case "lastMonth":
      return t.usageRangeLastMonth;
    case "schoolYear":
      return t.usageRangeSchoolYear;
  }
}

function kindLabel(kind: AnalysisJobKind, t: Dictionary) {
  return kind === "EXAM_STRUCTURE" ? t.usageKindStructure : t.usageKindScoring;
}

function tokens(value: number, recorded: boolean, locale: Locale) {
  if (!recorded) return "—";
  return formatTokenCount(value, locale);
}

function cost(value: number | null, complete: boolean, recorded: boolean, t: Dictionary) {
  if (!recorded) return "—";
  return formatUsd(value, complete, t.usageCostPartial) ?? "—";
}

function Stat({
  label,
  value,
  hint,
  tint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tint: string;
  icon: ReactNode;
}) {
  return (
    <article className="card card-pad">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-[var(--muted)]">{label}</p>
        <span
          className="icon-tile !h-10 !w-10 !rounded-xl"
          style={{ ["--tile-bg" as string]: tint, ["--tile-fg" as string]: "var(--ink)" }}
        >
          {icon}
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-[var(--ink)]">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
    </article>
  );
}

export default async function AdminUsagePage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string; schoolId?: string; from?: string; to?: string; kind?: string }>;
}) {
  const params = await searchParams;
  const locale = parseLocale(params.locale);
  const t = getDictionary(locale);
  const session = await requireRolePage("ADMIN", locale, "/admin/usage");
  const schoolId = session.user.schoolId?.trim() || null;
  const schoolYear = await resolveUsageSchoolYear(schoolId);
  const data = await getAnalysisUsagePage({
    schoolId,
    from: params.from,
    to: params.to,
    kind: params.kind,
  });
  const rangePresets = USAGE_RANGE_PRESETS.map((id) => ({
    id,
    label: rangePresetLabel(id, t),
    ...usagePresetRange(id, new Date(), schoolYear),
  }));
  const localeQuery = `locale=${locale}`;

  return (
    <AppShell user={session.user} locale={locale} t={t}>
      <PageHeader
        crumbs={[
          { label: t.navOverview, href: `/admin?${localeQuery}` },
          { label: t.usageNav },
        ]}
        title={t.usageTitle}
        description={t.usageIntro}
      />

      <form key={`${data.from}-${data.to}-${data.kind}`} method="get" className="card card-pad mt-6">
        <div className="flex flex-wrap gap-2" role="group" aria-label={t.usageRangePresets}>
          {rangePresets.map((preset) => {
            const active = preset.from === data.from && preset.to === data.to;
            const query = new URLSearchParams({
              locale,
              from: preset.from,
              to: preset.to,
              kind: data.kind,
            });
            return (
              <Link
                key={preset.id}
                href={`/admin/usage?${query.toString()}`}
                className={`btn btn-sm ${active ? "btn-primary" : "btn-secondary"}`}
                aria-current={active ? "true" : undefined}
              >
                {preset.label}
              </Link>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-4">
        <input type="hidden" name="locale" value={locale} />
        <div>
          <label className="label" htmlFor="usage-from">
            {t.usageFrom}
          </label>
          <input id="usage-from" name="from" type="date" required defaultValue={data.from} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="usage-to">
            {t.usageTo}
          </label>
          <input id="usage-to" name="to" type="date" required defaultValue={data.to} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="usage-kind">
            {t.usageKind}
          </label>
          <select id="usage-kind" name="kind" defaultValue={data.kind} className="input">
            <option value="ALL">{t.usageKindAll}</option>
            <option value="EXAM_STRUCTURE">{t.usageKindStructure}</option>
            <option value="SUBMISSION_SCORING">{t.usageKindScoring}</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary">
          {t.usageApply}
        </button>
        </div>
      </form>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label={t.usageCost}
          value={formatUsd(data.summary.costUsd, data.summary.costComplete, t.usageCostPartial) ?? "—"}
          hint={
            data.summary.recordedJobs > 0
              ? `${formatTokenCount(data.summary.recordedJobs, locale)} ${t.usageJobs}`
              : undefined
          }
          tint="var(--primary-soft, #dbeafe)"
          icon={<Icon.BarChart size={18} />}
        />
        <Stat
          label={t.usageTokens}
          value={
            data.summary.recordedJobs > 0
              ? formatTokenCount(data.summary.totalTokens, locale)
              : "—"
          }
          hint={
            data.summary.recordedJobs > 0
              ? `${t.usagePrompt} ${formatTokenCount(data.summary.promptTokens, locale)} · ${t.usageCompletion} ${formatTokenCount(data.summary.completionTokens, locale)}`
              : undefined
          }
          tint="#ccfbf1"
          icon={<Icon.Sparkles size={18} />}
        />
        <Stat
          label={t.usageStructureJobs}
          value={formatTokenCount(data.summary.structureJobs, locale)}
          tint="var(--role-admin-soft)"
          icon={<Icon.FileText size={18} />}
        />
        <Stat
          label={t.usageScoringJobs}
          value={formatTokenCount(data.summary.scoringJobs, locale)}
          tint="#fef3c7"
          icon={<Icon.GraduationCap size={18} />}
        />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">{t.usageFootnote}</p>

      <section className="card mt-6 overflow-hidden">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-base font-bold text-[var(--ink)]">{t.usageBreakdown}</h2>
        </div>
        {data.schools.length === 0 ? (
          <p className="px-5 py-8 text-sm text-[var(--muted)]">{t.usageEmpty}</p>
        ) : (
          <div>
            {data.schools.map((school) => (
              <SchoolBlock key={school.schoolId} school={school} locale={locale} t={t} />
            ))}
          </div>
        )}
      </section>

      <section className="card mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-base font-bold text-[var(--ink)]">
            {t.usageJobList}
            <span className="ml-2 text-xs font-medium text-[var(--muted)]">
              {t.jobStatusSucceeded} {formatTokenCount(data.summary.succeeded, locale)}
              {" · "}
              {t.jobStatusFailed} {formatTokenCount(data.summary.failed, locale)}
            </span>
          </h2>
          {data.truncated ? (
            <p className="text-xs text-[var(--muted)]">{t.usageTruncated}</p>
          ) : null}
        </div>
        {data.jobs.length === 0 ? (
          <p className="px-5 py-8 text-sm text-[var(--muted)]">{t.usageEmpty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[76rem] text-left text-sm">
              <thead className="bg-[var(--surface-muted,var(--surface))] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="px-5 py-3 font-semibold">{t.usageWhen}</th>
                  <th className="px-3 py-3 font-semibold">{t.usageSchool}</th>
                  <th className="px-3 py-3 font-semibold">{t.usageTeacher}</th>
                  <th className="px-3 py-3 font-semibold">{t.classLabel}</th>
                  <th className="px-3 py-3 font-semibold">{t.usageKind}</th>
                  <th className="px-3 py-3 font-semibold">{t.usageExam}</th>
                  <th className="px-3 py-3 font-semibold">{t.usageStudent}</th>
                  <th className="px-3 py-3 font-semibold">{t.usageModel}</th>
                  <th className="px-3 py-3 font-semibold">{t.usageStatus}</th>
                  <th className="px-3 py-3 text-right font-semibold">{t.usagePrompt}</th>
                  <th className="px-3 py-3 text-right font-semibold">{t.usageCompletion}</th>
                  <th className="px-5 py-3 text-right font-semibold">{t.usageCost}</th>
                </tr>
              </thead>
              <tbody>
                {data.jobs.map((job) => (
                  <JobRow key={job.id} job={job} locale={locale} t={t} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}

function joinNames(names: string[], locale: Locale): string | null {
  if (names.length === 0) return null;
  return names.join(locale === "zh-HK" ? "、" : ", ");
}

function rollupCost(rollup: UsageRollup, t: Dictionary) {
  if (rollup.recordedJobs === 0) return "—";
  return formatUsd(rollup.costUsd, rollup.costComplete, t.usageCostPartial) ?? "—";
}

function RollupFigures({ rollup, locale, t }: { rollup: UsageRollup; locale: Locale; t: Dictionary }) {
  return (
    <p className="shrink-0 text-right text-xs tabular-nums text-[var(--muted)]">
      <span className="font-semibold text-[var(--ink)]">{formatTokenCount(rollup.jobs, locale)}</span> {t.usageJobs}
      <span className="px-1.5 text-[var(--faint)]">·</span>
      {rollup.recordedJobs > 0 ? formatTokenCount(rollup.totalTokens, locale) : "—"} {t.usageTokens}
      <span className="px-1.5 text-[var(--faint)]">·</span>
      <span className="font-semibold text-primary-700">{rollupCost(rollup, t)}</span>
    </p>
  );
}

function SchoolBlock({
  school,
  locale,
  t,
}: {
  school: UsageSchoolNode;
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <details className="group/school border-t border-[var(--border)]">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 bg-primary-50 px-5 py-3 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <Icon.ChevronDown size={16} className="shrink-0 text-primary-700 transition-transform group-open/school:rotate-180" />
          <span>
            <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-700">{t.usageSchool}</span>
            <span className="block text-base font-bold text-[var(--ink)]">{school.name}</span>
          </span>
        </span>
        <RollupFigures rollup={school} locale={locale} t={t} />
      </summary>
      {school.teachers.map((teacher) => (
        <details key={teacher.teacherId} className="group/teacher border-t border-[var(--border)]">
          <summary
            className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 py-2.5 pr-5 pl-8 [&::-webkit-details-marker]:hidden"
            style={{ background: "var(--role-admin-soft)" }}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Icon.ChevronDown
                size={16}
                className="shrink-0 transition-transform group-open/teacher:rotate-180"
                style={{ color: "var(--role-admin)" }}
              />
              <span>
                <span className="block text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--role-admin)" }}>
                  {t.usageTeacher}
                </span>
                <span className="block font-semibold text-[var(--ink)]">
                  {joinNames(teacher.names, locale) ?? t.usageUnassigned}
                </span>
              </span>
            </span>
            <RollupFigures rollup={teacher} locale={locale} t={t} />
          </summary>
          {teacher.classes.map((classGroup) => (
            <details key={classGroup.classId} className="group/class border-t border-[var(--border)]">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 py-2.5 pr-5 pl-12 [&::-webkit-details-marker]:hidden">
                <span className="flex min-w-0 items-center gap-2">
                  <Icon.ChevronDown
                    size={16}
                    className="shrink-0 transition-transform group-open/class:rotate-180"
                    style={{ color: "var(--teal-600)" }}
                  />
                  <span>
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--teal-600)" }}>
                      {t.classLabel}
                    </span>
                    <span className="block font-medium text-[var(--ink)]">{classGroup.name ?? "—"}</span>
                  </span>
                </span>
                <RollupFigures rollup={classGroup} locale={locale} t={t} />
              </summary>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-[var(--muted)]">
                    <tr>
                      <th className="py-2 pl-16 pr-3 font-semibold">{t.usageExam}</th>
                      <th className="px-3 py-2 font-semibold">{t.dateLabel}</th>
                      <th className="px-3 py-2 text-right font-semibold">{t.usageJobs}</th>
                      <th className="px-3 py-2 text-right font-semibold">{t.usagePrompt}</th>
                      <th className="px-3 py-2 text-right font-semibold">{t.usageCompletion}</th>
                      <th className="px-5 py-2 text-right font-semibold">{t.usageCost}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classGroup.exams.map((exam) => (
                      <tr key={exam.examId} className="border-t border-[var(--border)]">
                        <td className="py-2.5 pl-16 pr-3 font-medium text-[var(--ink)]">{exam.title}</td>
                        <td className="px-3 py-2.5 tabular-nums text-[var(--ink-secondary)]">{exam.examDate}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatTokenCount(exam.jobs, locale)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {exam.recordedJobs > 0 ? formatTokenCount(exam.promptTokens, locale) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {exam.recordedJobs > 0 ? formatTokenCount(exam.completionTokens, locale) : "—"}
                        </td>
                        <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-primary-700">
                          {rollupCost(exam, t)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </details>
      ))}
    </details>
  );
}

function JobRow({ job, locale, t }: { job: UsageJobRow; locale: Locale; t: Dictionary }) {
  const recorded = job.callCount > 0;
  return (
    <tr className="border-t border-[var(--border)]">
      <td className="px-5 py-3 tabular-nums text-[var(--ink)]">
        {job.createdOn}
        <span className="mt-0.5 block text-xs text-[var(--muted)]">{job.createdAtTime}</span>
      </td>
      <td className="px-3 py-3 text-[var(--ink)]">{job.schoolName}</td>
      <td className="px-3 py-3 text-[var(--ink-secondary)]">{joinNames(job.teacherNames, locale) ?? t.usageUnassigned}</td>
      <td className="px-3 py-3 text-[var(--ink-secondary)]">{job.className ?? "—"}</td>
      <td className="px-3 py-3">
        <span className={job.kind === "EXAM_STRUCTURE" ? "badge badge-violet" : "badge badge-teal"}>
          {kindLabel(job.kind, t)}
        </span>
      </td>
      <td className="px-3 py-3 font-medium text-[var(--ink)]">{job.examTitle}</td>
      <td className="px-3 py-3 text-[var(--ink-secondary)]">{job.studentName ?? "—"}</td>
      <td className="max-w-[12rem] truncate px-3 py-3 font-mono text-xs text-[var(--muted)]" title={job.llmModel ?? undefined}>
        {job.llmModel ?? "—"}
      </td>
      <td className="px-3 py-3">
        <span className={`badge ${statusBadge[job.status]}`}>{statusLabel(job.status, t)}</span>
      </td>
      <td className="px-3 py-3 text-right tabular-nums">{tokens(job.promptTokens, recorded, locale)}</td>
      <td className="px-3 py-3 text-right tabular-nums">{tokens(job.completionTokens, recorded, locale)}</td>
      <td className="px-5 py-3 text-right font-semibold tabular-nums text-primary-700">
        {cost(job.costUsd, job.costComplete, recorded, t)}
      </td>
    </tr>
  );
}
