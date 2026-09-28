import type { AnalysisJobKind, AnalysisJobStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;
const PAGE_LIMIT = 200;

export type UsageKindFilter = "ALL" | AnalysisJobKind;

export type UsageRollup = {
  jobs: number;
  recordedJobs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number | null;
  costComplete: boolean;
};

export type UsageJobRow = {
  id: string;
  createdOn: string;
  createdAtTime: string;
  kind: AnalysisJobKind;
  status: AnalysisJobStatus;
  llmModel: string | null;
  schoolName: string;
  teacherNames: string[];
  className: string | null;
  examId: string | null;
  examTitle: string;
  studentName: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number | null;
  costComplete: boolean;
  callCount: number;
};

export type UsageExamNode = UsageRollup & {
  examId: string;
  title: string;
  examDate: string;
};

export type UsageClassNode = UsageRollup & {
  classId: string;
  name: string | null;
  exams: UsageExamNode[];
};

export type UsageTeacherNode = UsageRollup & {
  teacherId: string;
  names: string[];
  classes: UsageClassNode[];
};

export type UsageSchoolNode = UsageRollup & {
  schoolId: string;
  name: string;
  teachers: UsageTeacherNode[];
};

export type AnalysisUsagePageData = {
  from: string;
  to: string;
  kind: UsageKindFilter;
  truncated: boolean;
  summary: UsageRollup & {
    structureJobs: number;
    scoringJobs: number;
    succeeded: number;
    failed: number;
  };
  schools: UsageSchoolNode[];
  jobs: UsageJobRow[];
};

export function hkTodayYmd(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function shiftYmd(ymd: string, days: number): string {
  const match = YMD.exec(ymd);
  if (!match) return ymd;
  const dt = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function hkDateTimeParts(value: Date): { date: string; time: string } {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(value);
  return { date, time };
}

function parseYmd(value: string | undefined, fallback: string): string {
  if (value && YMD.test(value)) return value;
  return fallback;
}

function hkStart(ymd: string): Date {
  return new Date(`${ymd}T00:00:00+08:00`);
}

function hkEnd(ymd: string): Date {
  return new Date(`${ymd}T23:59:59.999+08:00`);
}

function money(value: Prisma.Decimal | null): number | null {
  if (value == null) return null;
  return value.toNumber();
}

type Fold = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number | null;
  costComplete: boolean;
  recordedJobs: number;
};

function foldUsage(
  rows: Array<{
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd: Prisma.Decimal | null;
    costComplete: boolean;
    llmCallCount: number;
  }>,
): Fold {
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  let cost = 0;
  let sawCost = false;
  let costComplete = true;
  let recordedJobs = 0;
  for (const row of rows) {
    promptTokens += row.promptTokens;
    completionTokens += row.completionTokens;
    totalTokens += row.totalTokens;
    if (row.llmCallCount <= 0) continue;
    recordedJobs += 1;
    const usd = money(row.costUsd);
    if (!row.costComplete || usd == null) costComplete = false;
    if (usd != null) {
      sawCost = true;
      cost += usd;
    }
  }
  return {
    promptTokens,
    completionTokens,
    totalTokens,
    costUsd: sawCost ? cost : null,
    costComplete,
    recordedJobs,
  };
}

const usageInclude = {
  school: {
    select: {
      id: true,
      name: true,
      settings: { select: { displayName: true } },
    },
  },
  exam: {
    select: {
      id: true,
      title: true,
      examDate: true,
      createdBy: { select: { id: true, name: true, email: true } },
      classSubject: {
        select: {
          id: true,
          name: true,
          enrollments: {
            where: { role: "TEACHER" as const },
            select: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      },
    },
  },
  submission: {
    select: { student: { select: { name: true, email: true } } },
  },
} satisfies Prisma.AnalysisJobInclude;

type UsageSource = Prisma.AnalysisJobGetPayload<{ include: typeof usageInclude }>;

function displayPerson(user: { name: string | null; email: string } | null | undefined): string | null {
  if (!user) return null;
  return user.name?.trim() || user.email;
}

function placement(row: UsageSource): {
  schoolId: string;
  schoolName: string;
  teacherId: string;
  teacherNames: string[];
  classId: string;
  className: string | null;
  examId: string;
  examTitle: string;
  examDate: string;
} {
  const schoolName = row.school.settings?.displayName?.trim() || row.school.name;
  const classSubject = row.exam?.classSubject;
  const enrolled = (classSubject?.enrollments ?? [])
    .map((enrollment) => enrollment.user)
    .map((user) => ({ id: user.id, name: displayPerson(user) ?? user.email }))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-HK"));
  const createdBy = row.exam?.createdBy;
  const createdName = displayPerson(createdBy);
  const teachers =
    enrolled.length > 0
      ? enrolled
      : createdBy && createdName
        ? [{ id: createdBy.id, name: createdName }]
        : [];
  return {
    schoolId: row.schoolId,
    schoolName,
    teacherId: teachers.length > 0 ? teachers.map((teacher) => teacher.id).join("|") : "unassigned",
    teacherNames: teachers.map((teacher) => teacher.name),
    classId: classSubject?.id ?? "none",
    className: classSubject?.name ?? null,
    examId: row.examId ?? "none",
    examTitle: row.exam?.title ?? "—",
    examDate: row.exam ? hkDateTimeParts(row.exam.examDate).date : "—",
  };
}

function toRollup(rows: UsageSource[]): UsageRollup {
  return { jobs: rows.length, ...foldUsage(rows) };
}

function compareRollup(a: UsageRollup, b: UsageRollup): number {
  return (b.costUsd ?? 0) - (a.costUsd ?? 0) || b.totalTokens - a.totalTokens || b.jobs - a.jobs;
}

function buildSchoolTree(rows: UsageSource[]): UsageSchoolNode[] {
  const schools = new Map<string, { name: string; rows: UsageSource[] }>();
  for (const row of rows) {
    const place = placement(row);
    const school = schools.get(place.schoolId) ?? { name: place.schoolName, rows: [] };
    school.rows.push(row);
    schools.set(place.schoolId, school);
  }

  return [...schools.entries()]
    .map(([schoolId, school]) => {
      const teachers = new Map<string, { names: string[]; rows: UsageSource[] }>();
      for (const row of school.rows) {
        const place = placement(row);
        const teacher = teachers.get(place.teacherId) ?? { names: place.teacherNames, rows: [] };
        teacher.rows.push(row);
        teachers.set(place.teacherId, teacher);
      }
      const teacherNodes = [...teachers.entries()]
        .map(([teacherId, teacher]) => {
          const classes = new Map<string, { name: string | null; rows: UsageSource[] }>();
          for (const row of teacher.rows) {
            const place = placement(row);
            const classGroup = classes.get(place.classId) ?? { name: place.className, rows: [] };
            classGroup.rows.push(row);
            classes.set(place.classId, classGroup);
          }
          const classNodes = [...classes.entries()]
            .map(([classId, classGroup]) => {
              const exams = new Map<string, { title: string; examDate: string; rows: UsageSource[] }>();
              for (const row of classGroup.rows) {
                const place = placement(row);
                const exam = exams.get(place.examId) ?? {
                  title: place.examTitle,
                  examDate: place.examDate,
                  rows: [],
                };
                exam.rows.push(row);
                exams.set(place.examId, exam);
              }
              const examNodes = [...exams.entries()]
                .map(([examId, exam]) => ({
                  examId,
                  title: exam.title,
                  examDate: exam.examDate,
                  ...toRollup(exam.rows),
                }))
                .sort(compareRollup);
              return { classId, name: classGroup.name, exams: examNodes, ...toRollup(classGroup.rows) };
            })
            .sort((a, b) => compareRollup(a, b) || (a.name ?? "").localeCompare(b.name ?? "", "zh-HK"));
          return { teacherId, names: teacher.names, classes: classNodes, ...toRollup(teacher.rows) };
        })
        .sort((a, b) => compareRollup(a, b) || a.names.join().localeCompare(b.names.join(), "zh-HK"));
      return { schoolId, name: school.name, teachers: teacherNodes, ...toRollup(school.rows) };
    })
    .sort((a, b) => compareRollup(a, b) || a.name.localeCompare(b.name, "zh-HK"));
}

export async function getAnalysisUsagePage(input: {
  /** Null lists every school. A school admin passes their own school id. */
  schoolId: string | null;
  from?: string;
  to?: string;
  kind?: string;
}): Promise<AnalysisUsagePageData> {
  const today = hkTodayYmd();
  let from = parseYmd(input.from, shiftYmd(today, -29));
  let to = parseYmd(input.to, today);
  if (from > to) {
    const swap = from;
    from = to;
    to = swap;
  }
  const kind: UsageKindFilter =
    input.kind === "EXAM_STRUCTURE" || input.kind === "SUBMISSION_SCORING" ? input.kind : "ALL";

  const where: Prisma.AnalysisJobWhereInput = {
    ...(input.schoolId ? { schoolId: input.schoolId } : {}),
    createdAt: { gte: hkStart(from), lte: hkEnd(to) },
    ...(kind === "ALL" ? {} : { kind }),
  };

  const usageRows = await prisma.analysisJob.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: usageInclude,
  });

  const jobs: UsageJobRow[] = usageRows.slice(0, PAGE_LIMIT).map((row) => {
    const when = hkDateTimeParts(row.createdAt);
    const place = placement(row);
    const student = row.submission?.student;
    return {
      id: row.id,
      createdOn: when.date,
      createdAtTime: when.time,
      kind: row.kind,
      status: row.status,
      llmModel: row.llmModel,
      schoolName: place.schoolName,
      teacherNames: place.teacherNames,
      className: place.className,
      examId: row.examId,
      examTitle: place.examTitle,
      studentName: student?.name?.trim() || student?.email || null,
      promptTokens: row.promptTokens,
      completionTokens: row.completionTokens,
      totalTokens: row.totalTokens,
      costUsd: money(row.costUsd),
      costComplete: row.costComplete,
      callCount: row.llmCallCount,
    };
  });

  const folded = foldUsage(usageRows);

  return {
    from,
    to,
    kind,
    truncated: usageRows.length > PAGE_LIMIT,
    summary: {
      structureJobs: usageRows.filter((row) => row.kind === "EXAM_STRUCTURE").length,
      scoringJobs: usageRows.filter((row) => row.kind === "SUBMISSION_SCORING").length,
      succeeded: usageRows.filter((row) => row.status === "SUCCEEDED").length,
      failed: usageRows.filter((row) => row.status === "FAILED").length,
      ...toRollup(usageRows),
      ...folded,
    },
    schools: buildSchoolTree(usageRows),
    jobs,
  };
}

export function formatTokenCount(value: number, locale: "en" | "zh-HK"): string {
  return new Intl.NumberFormat(locale === "zh-HK" ? "zh-HK" : "en-HK").format(value);
}

export function formatUsd(
  value: number | null,
  costComplete: boolean,
  partialLabel: string,
): string | null {
  if (value == null) return null;
  const formatted = new Intl.NumberFormat("en-HK", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(value);
  return costComplete ? formatted : `${formatted} (${partialLabel})`;
}
