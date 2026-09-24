/**
 * In-process analysis job runner (MVP).
 *
 * - Creates AnalysisJob rows with llmModel from SchoolSettings.analysisLlmModel
 * - Runs structure / scoring via createLlmClient (OpenRouter)
 * - Persists llmModel on AnalysisJob + Exam.structureLlmModel / Submission.scoringLlmModel
 * - Product errors stay vendor-neutral
 *
 * Swap for a real queue later; UI polls GET /api/jobs/[jobId].
 */

import type { AnalysisJobKind, Prisma } from "@prisma/client";
import { refreshSubjectAggregates } from "@/lib/aggregates/weakness";
import { AppError, ANALYSIS_FAILED_GENERIC, sanitizeVendorLeak } from "@/lib/errors";
import { createLlmClient } from "@/lib/llm";
import { prisma } from "@/lib/prisma";
import { resolveAnalysisLlmModelForNewJob } from "@/lib/school-settings";
import { getSubjectSyllabus } from "@/lib/subjects/syllabus";

export type EnqueueResult = {
  jobId: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  llmModel: string;
  kind: AnalysisJobKind;
};

const running = new Set<string>();

function schedule(jobId: string) {
  // Fire-and-forget; errors handled inside processJob.
  void processJob(jobId);
}

export async function enqueueAnalyzeExam(payload: {
  schoolId: string;
  examId: string;
  requestedByUserId?: string;
}): Promise<EnqueueResult> {
  const llmModel = await resolveAnalysisLlmModelForNewJob(payload.schoolId);

  const exam = await prisma.exam.findFirst({
    where: { id: payload.examId, schoolId: payload.schoolId },
  });
  if (!exam) {
    throw new AppError("Exam not found", 404, "exam_not_found");
  }

  const assets = await prisma.asset.findMany({
    where: {
      examId: payload.examId,
      schoolId: payload.schoolId,
      kind: { in: ["QUESTION_PAPER", "ANSWER_KEY"] },
    },
  });
  if (assets.length === 0) {
    throw new AppError("請檢查檔案 — upload a question paper first", 400, "missing_assets");
  }

  const job = await prisma.analysisJob.create({
    data: {
      schoolId: payload.schoolId,
      examId: payload.examId,
      kind: "EXAM_STRUCTURE",
      status: "PENDING",
      llmModel,
      createdById: payload.requestedByUserId ?? null,
    },
  });

  schedule(job.id);
  return {
    jobId: job.id,
    status: "PENDING",
    llmModel,
    kind: "EXAM_STRUCTURE",
  };
}

export async function enqueueAnalyzeSubmission(payload: {
  schoolId: string;
  examId: string;
  submissionId: string;
  requestedByUserId?: string;
}): Promise<EnqueueResult> {
  const llmModel = await resolveAnalysisLlmModelForNewJob(payload.schoolId);

  const submission = await prisma.submission.findFirst({
    where: {
      id: payload.submissionId,
      examId: payload.examId,
      schoolId: payload.schoolId,
    },
  });
  if (!submission) {
    throw new AppError("Submission not found", 404, "submission_not_found");
  }
  if (!submission.assetId) {
    throw new AppError("請檢查檔案 — upload an answer script first", 400, "missing_script");
  }

  await prisma.submission.update({
    where: { id: submission.id },
    data: {
      status: "QUEUED",
      errorMessage: null,
    },
  });

  const job = await prisma.analysisJob.create({
    data: {
      schoolId: payload.schoolId,
      examId: payload.examId,
      submissionId: payload.submissionId,
      kind: "SUBMISSION_SCORING",
      status: "PENDING",
      llmModel,
      createdById: payload.requestedByUserId ?? null,
    },
  });

  schedule(job.id);
  return {
    jobId: job.id,
    status: "PENDING",
    llmModel,
    kind: "SUBMISSION_SCORING",
  };
}

/** Retry a failed job by enqueuing a fresh run of the same kind. */
export async function retryAnalysisJob(
  jobId: string,
  requestedByUserId?: string,
): Promise<EnqueueResult> {
  const existing = await prisma.analysisJob.findUnique({ where: { id: jobId } });
  if (!existing) {
    throw new AppError("Job not found", 404, "job_not_found");
  }
  if (existing.kind === "EXAM_STRUCTURE") {
    if (!existing.examId) {
      throw new AppError("Job missing exam", 400, "job_invalid");
    }
    return enqueueAnalyzeExam({
      schoolId: existing.schoolId,
      examId: existing.examId,
      requestedByUserId,
    });
  }
  if (!existing.examId || !existing.submissionId) {
    throw new AppError("Job missing submission", 400, "job_invalid");
  }
  return enqueueAnalyzeSubmission({
    schoolId: existing.schoolId,
    examId: existing.examId,
    submissionId: existing.submissionId,
    requestedByUserId,
  });
}

export async function processJob(jobId: string): Promise<void> {
  if (running.has(jobId)) return;
  running.add(jobId);
  try {
    const job = await prisma.analysisJob.findUnique({ where: { id: jobId } });
    if (!job || job.status === "SUCCEEDED" || job.status === "RUNNING") {
      return;
    }

    const llmModel =
      job.llmModel ||
      (await resolveAnalysisLlmModelForNewJob(job.schoolId));

    await prisma.analysisJob.update({
      where: { id: jobId },
      data: {
        status: "RUNNING",
        llmModel,
        startedAt: new Date(),
        errorMessage: null,
      },
    });

    if (job.kind === "EXAM_STRUCTURE") {
      await runExamStructure(jobId, job.schoolId, job.examId!, llmModel);
    } else {
      await runSubmissionScoring(
        jobId,
        job.schoolId,
        job.examId!,
        job.submissionId!,
        llmModel,
      );
    }
  } catch (error) {
    const message =
      error instanceof AppError
        ? error.message
        : sanitizeVendorLeak(
            error instanceof Error ? error.message : ANALYSIS_FAILED_GENERIC,
          );
    await failJob(jobId, message);
  } finally {
    running.delete(jobId);
  }
}

async function failJob(jobId: string, message: string) {
  const safe = sanitizeVendorLeak(message || ANALYSIS_FAILED_GENERIC);
  const job = await prisma.analysisJob.update({
    where: { id: jobId },
    data: {
      status: "FAILED",
      errorMessage: safe,
      finishedAt: new Date(),
    },
  });
  if (job.submissionId) {
    await prisma.submission.update({
      where: { id: job.submissionId },
      data: { status: "FAILED", errorMessage: safe },
    });
  }
}

async function runExamStructure(
  jobId: string,
  schoolId: string,
  examId: string,
  llmModel: string,
) {
  const assets = await prisma.asset.findMany({
    where: {
      examId,
      schoolId,
      kind: { in: ["QUESTION_PAPER", "ANSWER_KEY"] },
    },
  });
  if (assets.length === 0) {
    throw new AppError("請檢查檔案", 400, "missing_assets");
  }

  const examRow = await prisma.exam.findFirst({
    where: { id: examId, schoolId },
    include: { classSubject: { select: { subjectCode: true } } },
  });
  const syllabus = examRow
    ? await getSubjectSyllabus(schoolId, examRow.classSubject.subjectCode)
    : null;

  const llm = createLlmClient();
  const result = await llm.analyzeExamStructure({
    schoolId,
    examId,
    modelOverride: llmModel,
    assetRefs: [
      ...assets.map((a) => ({
        kind: a.kind,
        storageKey: a.storageKey,
        mimeType: a.mimeType,
      })),
      ...(syllabus
        ? [
            {
              kind: "SYLLABUS",
              storageKey: syllabus.storageKey,
              mimeType: syllabus.mimeType,
            },
          ]
        : []),
    ],
  });

  // Schema has no ExamStructure table — cache questions on disk for scoring.
  await structureCache.set(examId, result.questions);

  await prisma.exam.update({
    where: { id: examId },
    data: { structureLlmModel: result.llmModel },
  });

  await prisma.analysisJob.update({
    where: { id: jobId },
    data: {
      status: "SUCCEEDED",
      llmModel: result.llmModel,
      finishedAt: new Date(),
      errorMessage: null,
    },
  });
}

async function runSubmissionScoring(
  jobId: string,
  schoolId: string,
  examId: string,
  submissionId: string,
  llmModel: string,
) {
  await prisma.submission.update({
    where: { id: submissionId },
    data: { status: "ANALYZING", errorMessage: null },
  });

  const submission = await prisma.submission.findFirstOrThrow({
    where: { id: submissionId, schoolId },
    include: { asset: true },
  });
  if (!submission.asset) {
    throw new AppError("請檢查檔案", 400, "missing_script");
  }

  let questions = await structureCache.get(examId);
  if (!questions || questions.length === 0) {
    // Rebuild from a prior successful structure job is not stored — use demo structure
    // if exam has structureLlmModel set, fall back to default questions for scoring MVP.
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam?.structureLlmModel) {
      throw new AppError(
        "Exam structure analysis has not completed yet.",
        400,
        "structure_required",
      );
    }
    // Re-run structure from assets to recover questions when process restarted.
    const assets = await prisma.asset.findMany({
      where: {
        examId,
        schoolId,
        kind: { in: ["QUESTION_PAPER", "ANSWER_KEY"] },
      },
    });
    const examWithSubject = await prisma.exam.findFirst({
      where: { id: examId, schoolId },
      include: { classSubject: { select: { subjectCode: true } } },
    });
    const syllabus = examWithSubject
      ? await getSubjectSyllabus(schoolId, examWithSubject.classSubject.subjectCode)
      : null;
    const llmRecover = createLlmClient();
    const recovered = await llmRecover.analyzeExamStructure({
      schoolId,
      examId,
      modelOverride: exam.structureLlmModel,
      assetRefs: [
        ...assets.map((a) => ({
          kind: a.kind,
          storageKey: a.storageKey,
          mimeType: a.mimeType,
        })),
        ...(syllabus
          ? [
              {
                kind: "SYLLABUS",
                storageKey: syllabus.storageKey,
                mimeType: syllabus.mimeType,
              },
            ]
          : []),
      ],
    });
    questions = recovered.questions;
    await structureCache.set(examId, questions);
  }

  const llm = createLlmClient();
  const result = await llm.scoreSubmission({
    schoolId,
    examId,
    submissionId,
    modelOverride: llmModel,
    questions,
    assetRefs: [
      {
        kind: submission.asset.kind,
        storageKey: submission.asset.storageKey,
        mimeType: submission.asset.mimeType,
      },
    ],
  });

  await prisma.$transaction(async (tx) => {
    await tx.questionScore.deleteMany({ where: { submissionId } });
    if (result.scores.length > 0) {
      await tx.questionScore.createMany({
        data: result.scores.map((s) => ({
          schoolId,
          submissionId,
          questionKey: s.questionKey,
          topic: s.topic,
          itemType: s.itemType,
          score: s.score,
          maxScore: s.maxScore,
          feedback: s.feedback ?? null,
        })),
      });
    }

    await tx.submission.update({
      where: { id: submissionId },
      data: {
        status: "DONE",
        scoringLlmModel: result.llmModel,
        analyzedAt: new Date(),
        errorMessage: null,
      },
    });

    await tx.analysisJob.update({
      where: { id: jobId },
      data: {
        status: "SUCCEEDED",
        llmModel: result.llmModel,
        finishedAt: new Date(),
        errorMessage: null,
      },
    });
  });

  await refreshSubjectAggregates(schoolId, examId, submission.enrollmentId);
}

/** In-memory + DB-backed structure cache (survives via ExamStructureBlob table avoidance). */
type QuestionShape = {
  questionKey: string;
  topic: string;
  itemType: string;
  questionCategory: string;
  maxScore: number;
  assessmentObjective: string;
  difficultyPoints: string;
};

/**
 * Persist exam structure JSON on AnalysisJob is not in schema.
 * We store via a lightweight Prisma model workaround: encode in SubjectAggregate
 * is wrong. Use filesystem cache next to uploads instead.
 */
const structureCache = {
  async set(examId: string, questions: QuestionShape[]) {
    const { mkdir, writeFile } = await import("fs/promises");
    const path = await import("path");
    const dir = path.join(process.cwd(), ".data", "exam-structure");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, `${examId}.json`),
      JSON.stringify(questions),
      "utf8",
    );
  },
  async get(examId: string): Promise<QuestionShape[] | null> {
    try {
      const { readFile } = await import("fs/promises");
      const path = await import("path");
      const raw = await readFile(
        path.join(process.cwd(), ".data", "exam-structure", `${examId}.json`),
        "utf8",
      );
      const parsed = JSON.parse(raw) as Array<Partial<QuestionShape>>;
      if (!Array.isArray(parsed)) return null;
      return parsed
        .filter((q) => q.questionKey && q.topic && q.itemType)
        .map((q) => ({
          questionKey: String(q.questionKey),
          topic: String(q.topic),
          itemType: String(q.itemType),
          questionCategory: String(q.questionCategory ?? "").trim(),
          maxScore: Number(q.maxScore) || 1,
          assessmentObjective: String(q.assessmentObjective ?? "").trim(),
          difficultyPoints: String(q.difficultyPoints ?? "").trim(),
        }));
    } catch {
      return null;
    }
  },
};

/** Read persisted exam structure questions (filesystem cache). */
export async function getExamStructureQuestions(
  examId: string,
): Promise<QuestionShape[] | null> {
  return structureCache.get(examId);
}

export type { Prisma };
