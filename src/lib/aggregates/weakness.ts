/**
 * Same-subject cross-exam weakness aggregation.
 * Reuses stored QuestionScore topic / itemType tags — no extra LLM calls.
 */

import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/rbac";

export type RelatedExam = {
  examId: string;
  title: string;
  examDate: string;
  submissionId: string;
};

export type WeaknessBucket = {
  topic: string;
  itemType: string;
  avgScoreRatio: number;
  attemptCount: number;
  examCount: number;
};

export type TopicWeakness = {
  topic: string;
  avgScoreRatio: number;
  attemptCount: number;
  examCount: number;
  relatedExams: RelatedExam[];
};

export type ItemTypeWeakness = {
  itemType: string;
  avgScoreRatio: number;
  attemptCount: number;
  examCount: number;
};

export type StudentWeaknessSummary = {
  classSubject: { id: string; name: string; subjectCode: string };
  student: { id: string; name: string | null; email: string };
  enrollmentId: string;
  succeededExamCount: number;
  ready: boolean;
  byTopic: TopicWeakness[];
  byItemType: ItemTypeWeakness[];
  buckets: WeaknessBucket[];
};

type ScoreRow = {
  topic: string;
  itemType: string;
  score: number;
  maxScore: number;
  examId: string;
  examTitle: string;
  examDate: Date;
  submissionId: string;
};

function requireSchoolId(user: SessionUser): string {
  if (!user.schoolId) {
    throw new AppError("School context required", 403, "no_school");
  }
  return user.schoolId;
}

function formatDateYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function assertTeacherOwnsClass(user: SessionUser, classSubjectId: string) {
  const schoolId = requireSchoolId(user);
  if (user.role !== "TEACHER" && user.role !== "ADMIN") {
    throw new AppError("Forbidden", 403, "forbidden");
  }
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      classSubjectId,
      userId: user.id,
      schoolId,
      role: "TEACHER",
    },
  });
  if (!enrollment && user.role !== "ADMIN") {
    throw new AppError("Forbidden", 403, "forbidden");
  }
  const cs = await prisma.classSubject.findFirst({
    where: { id: classSubjectId, schoolId },
  });
  if (!cs) {
    throw new AppError("Class not found", 404, "class_not_found");
  }
  return { schoolId, classSubjectId };
}

function ratio(score: number, maxScore: number) {
  return maxScore > 0 ? score / maxScore : 0;
}

function aggregateFromScores(scores: ScoreRow[]) {
  const bucketMap = new Map<
    string,
    {
      topic: string;
      itemType: string;
      sum: number;
      count: number;
      examIds: Set<string>;
    }
  >();
  const topicMap = new Map<
    string,
    {
      topic: string;
      sum: number;
      count: number;
      examIds: Set<string>;
      related: Map<string, RelatedExam>;
    }
  >();
  const typeMap = new Map<
    string,
    {
      itemType: string;
      sum: number;
      count: number;
      examIds: Set<string>;
    }
  >();

  for (const s of scores) {
    const r = ratio(s.score, s.maxScore);
    const bKey = `${s.topic}::${s.itemType}`;
    const b = bucketMap.get(bKey) ?? {
      topic: s.topic,
      itemType: s.itemType,
      sum: 0,
      count: 0,
      examIds: new Set<string>(),
    };
    b.sum += r;
    b.count += 1;
    b.examIds.add(s.examId);
    bucketMap.set(bKey, b);

    const t = topicMap.get(s.topic) ?? {
      topic: s.topic,
      sum: 0,
      count: 0,
      examIds: new Set<string>(),
      related: new Map<string, RelatedExam>(),
    };
    t.sum += r;
    t.count += 1;
    t.examIds.add(s.examId);
    if (!t.related.has(s.examId)) {
      t.related.set(s.examId, {
        examId: s.examId,
        title: s.examTitle,
        examDate: formatDateYmd(s.examDate),
        submissionId: s.submissionId,
      });
    }
    topicMap.set(s.topic, t);

    const it = typeMap.get(s.itemType) ?? {
      itemType: s.itemType,
      sum: 0,
      count: 0,
      examIds: new Set<string>(),
    };
    it.sum += r;
    it.count += 1;
    it.examIds.add(s.examId);
    typeMap.set(s.itemType, it);
  }

  const buckets: WeaknessBucket[] = [...bucketMap.values()]
    .map((b) => ({
      topic: b.topic,
      itemType: b.itemType,
      avgScoreRatio: b.count ? b.sum / b.count : 0,
      attemptCount: b.count,
      examCount: b.examIds.size,
    }))
    .sort((a, b) => a.avgScoreRatio - b.avgScoreRatio || a.topic.localeCompare(b.topic));

  const byTopic: TopicWeakness[] = [...topicMap.values()]
    .map((t) => ({
      topic: t.topic,
      avgScoreRatio: t.count ? t.sum / t.count : 0,
      attemptCount: t.count,
      examCount: t.examIds.size,
      relatedExams: [...t.related.values()].sort((a, b) =>
        b.examDate.localeCompare(a.examDate),
      ),
    }))
    .sort((a, b) => a.avgScoreRatio - b.avgScoreRatio || a.topic.localeCompare(b.topic));

  const byItemType: ItemTypeWeakness[] = [...typeMap.values()]
    .map((t) => ({
      itemType: t.itemType,
      avgScoreRatio: t.count ? t.sum / t.count : 0,
      attemptCount: t.count,
      examCount: t.examIds.size,
    }))
    .sort(
      (a, b) =>
        a.avgScoreRatio - b.avgScoreRatio || a.itemType.localeCompare(b.itemType),
    );

  return { buckets, byTopic, byItemType };
}

/** Persist per-enrollment SubjectAggregate rows after a successful scoring job. */
export async function refreshSubjectAggregates(
  schoolId: string,
  examId: string,
  enrollmentId: string,
) {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) return;

  const classSubjectId = exam.classSubjectId;

  const submissions = await prisma.submission.findMany({
    where: {
      schoolId,
      enrollmentId,
      status: "DONE",
      exam: { classSubjectId },
    },
    include: {
      questionScores: true,
      exam: { select: { id: true, title: true, examDate: true } },
    },
  });

  const scores: ScoreRow[] = [];
  for (const sub of submissions) {
    for (const q of sub.questionScores) {
      scores.push({
        topic: q.topic,
        itemType: q.itemType,
        score: q.score,
        maxScore: q.maxScore,
        examId: sub.exam.id,
        examTitle: sub.exam.title,
        examDate: sub.exam.examDate,
        submissionId: sub.id,
      });
    }
  }

  const { buckets } = aggregateFromScores(scores);
  const keepKeys = new Set(buckets.map((b) => `${b.topic}::${b.itemType}`));

  for (const b of buckets) {
    await prisma.subjectAggregate.upsert({
      where: {
        classSubjectId_enrollmentId_topic_itemType: {
          classSubjectId,
          enrollmentId,
          topic: b.topic,
          itemType: b.itemType,
        },
      },
      create: {
        schoolId,
        classSubjectId,
        enrollmentId,
        topic: b.topic,
        itemType: b.itemType,
        examCount: b.examCount,
        attemptCount: b.attemptCount,
        avgScoreRatio: b.avgScoreRatio,
        lastComputedAt: new Date(),
      },
      update: {
        examCount: b.examCount,
        attemptCount: b.attemptCount,
        avgScoreRatio: b.avgScoreRatio,
        lastComputedAt: new Date(),
      },
    });
  }

  const existing = await prisma.subjectAggregate.findMany({
    where: { schoolId, classSubjectId, enrollmentId },
  });
  const staleIds = existing
    .filter((row) => !keepKeys.has(`${row.topic}::${row.itemType}`))
    .map((row) => row.id);
  if (staleIds.length > 0) {
    await prisma.subjectAggregate.deleteMany({
      where: { id: { in: staleIds } },
    });
  }
}

async function resolveTargetEnrollment(input: {
  schoolId: string;
  classSubjectId: string;
  studentId: string;
}) {
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      schoolId: input.schoolId,
      classSubjectId: input.classSubjectId,
      userId: input.studentId,
      role: "STUDENT",
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      classSubject: {
        select: { id: true, name: true, subjectCode: true },
      },
    },
  });
  if (!enrollment) {
    throw new AppError("Student not enrolled in this class", 404, "not_enrolled");
  }
  return enrollment;
}

/**
 * Student: own aggregates only.
 * Teacher: own-class student only (class-scoped RBAC).
 */
export async function getStudentWeaknessForUser(
  user: SessionUser,
  classSubjectId: string,
  studentIdParam?: string | null,
): Promise<StudentWeaknessSummary> {
  const schoolId = requireSchoolId(user);

  const classSubject = await prisma.classSubject.findFirst({
    where: { id: classSubjectId, schoolId },
  });
  if (!classSubject) {
    throw new AppError("Class not found", 404, "class_not_found");
  }

  let studentId: string;
  if (user.role === "STUDENT") {
    studentId = user.id;
    if (studentIdParam && studentIdParam !== user.id) {
      throw new AppError("Forbidden", 403, "forbidden");
    }
    const own = await prisma.enrollment.findFirst({
      where: {
        schoolId,
        classSubjectId,
        userId: user.id,
        role: "STUDENT",
      },
    });
    if (!own) {
      throw new AppError("Forbidden", 403, "forbidden");
    }
  } else if (user.role === "TEACHER" || user.role === "ADMIN") {
    await assertTeacherOwnsClass(user, classSubjectId);
    if (!studentIdParam) {
      throw new AppError("studentId is required", 400, "student_required");
    }
    studentId = studentIdParam;
  } else {
    throw new AppError("Forbidden", 403, "forbidden");
  }

  const enrollment = await resolveTargetEnrollment({
    schoolId,
    classSubjectId,
    studentId,
  });

  const submissions = await prisma.submission.findMany({
    where: {
      schoolId,
      enrollmentId: enrollment.id,
      status: "DONE",
      exam: { classSubjectId },
    },
    include: {
      questionScores: true,
      exam: { select: { id: true, title: true, examDate: true } },
    },
    orderBy: { analyzedAt: "desc" },
  });

  const scores: ScoreRow[] = [];
  for (const sub of submissions) {
    for (const q of sub.questionScores) {
      scores.push({
        topic: q.topic,
        itemType: q.itemType,
        score: q.score,
        maxScore: q.maxScore,
        examId: sub.exam.id,
        examTitle: sub.exam.title,
        examDate: sub.exam.examDate,
        submissionId: sub.id,
      });
    }
  }

  const { buckets, byTopic, byItemType } = aggregateFromScores(scores);
  const succeededExamCount = submissions.length;

  return {
    classSubject: {
      id: enrollment.classSubject.id,
      name: enrollment.classSubject.name,
      subjectCode: enrollment.classSubject.subjectCode,
    },
    student: enrollment.user,
    enrollmentId: enrollment.id,
    succeededExamCount,
    ready: succeededExamCount >= 2,
    byTopic,
    byItemType,
    buckets,
  };
}

/** Subjects the current student is enrolled in (for entry links). */
export async function listStudentClassSubjects(user: SessionUser) {
  const schoolId = requireSchoolId(user);
  if (user.role !== "STUDENT") {
    throw new AppError("Forbidden", 403, "forbidden");
  }
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: user.id, schoolId, role: "STUDENT" },
    include: {
      classSubject: {
        select: { id: true, name: true, subjectCode: true },
      },
      submissions: {
        where: { status: "DONE" },
        select: { id: true, examId: true },
      },
    },
  });

  return enrollments.map((e) => {
    const examIds = new Set(e.submissions.map((s) => s.examId));
    return {
      id: e.classSubject.id,
      name: e.classSubject.name,
      subjectCode: e.classSubject.subjectCode,
      succeededExamCount: examIds.size,
      ready: examIds.size >= 2,
    };
  });
}
