/**
 * Analysis job stub — in-process only.
 *
 * TODO(knife-1): Replace with a real queue (Inngest / BullMQ / SQS / etc.).
 * TODO(knife-1): Worker should: load Asset from storage → OpenRouter multimodal LLM
 *   (`createLlmClient`) → write QuestionScore rows → persist llmModel on AnalysisJob
 *   + Exam.structureLlmModel / Submission.scoringLlmModel → mark Submission DONE →
 *   refresh SubjectAggregate. Product UI must not show vendor names.
 * Do NOT call external LLM APIs from this scaffold.
 */

import { createLlmClient } from "@/lib/llm";

export type AnalyzeExamPayload = {
  schoolId: string;
  examId: string;
  /** Optional: analyze one submission; omit for whole-exam batch (later). */
  submissionId?: string;
  requestedByUserId?: string;
};

export type JobStubResult = {
  jobId: string;
  status: "queued_stub";
  message: string;
};

function fakeJobId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Enqueue exam-level analysis (stub). */
export async function enqueueAnalyzeExam(
  payload: AnalyzeExamPayload,
): Promise<JobStubResult> {
  const jobId = fakeJobId("exam");
  // Resolve client so the OpenRouter wiring path is exercised (no live HTTP).
  const llm = createLlmClient();
  void llm;

  // In-process stub: log only. Persist AnalysisJob via Prisma when DB is wired in knife 1.
  console.info("[jobs/analyze-exam] stub enqueue", { jobId, ...payload });
  return {
    jobId,
    status: "queued_stub",
    message:
      "Analysis job accepted (in-process stub). Wire a real queue + OpenRouter worker in knife 1.",
  };
}

/** Enqueue a single submission analysis (stub). */
export async function enqueueAnalyzeSubmission(payload: {
  schoolId: string;
  examId: string;
  submissionId: string;
  requestedByUserId?: string;
}): Promise<JobStubResult> {
  return enqueueAnalyzeExam(payload);
}
