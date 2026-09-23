import { NextResponse } from "next/server";
import { jsonError } from "@/lib/errors";
import { requireSessionUser } from "@/lib/api/session";
import { getJobForUser } from "@/lib/exams/service";
import { retryAnalysisJob, processJob } from "@/lib/jobs/analyze-exam";

type Ctx = { params: Promise<{ jobId: string }> };

/** Poll analysis job status (UI five-states). */
export async function GET(_request: Request, context: Ctx) {
  try {
    const user = await requireSessionUser();
    const { jobId } = await context.params;
    const job = await getJobForUser(user, jobId);

    // Nudge stuck PENDING jobs (serverless-friendly re-entry).
    if (job.status === "PENDING") {
      void processJob(job.id);
    }

    return NextResponse.json({
      job: {
        id: job.id,
        status: job.status,
        kind: job.kind,
        llmModel: job.llmModel,
        errorMessage: job.errorMessage,
        examId: job.examId,
        submissionId: job.submissionId,
        startedAt: job.startedAt?.toISOString() ?? null,
        finishedAt: job.finishedAt?.toISOString() ?? null,
        createdAt: job.createdAt.toISOString(),
      },
    });
  } catch (error) {
    const { body, status } = jsonError(error, "Could not load job", 500);
    return NextResponse.json(body, { status });
  }
}

/** Retry a failed job. */
export async function POST(_request: Request, context: Ctx) {
  try {
    const user = await requireSessionUser();
    if (user.role !== "TEACHER" && user.role !== "STUDENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { jobId } = await context.params;
    await getJobForUser(user, jobId);
    const result = await retryAnalysisJob(jobId, user.id);
    return NextResponse.json(result);
  } catch (error) {
    const { body, status } = jsonError(error, "Could not retry job", 500);
    return NextResponse.json(body, { status });
  }
}
