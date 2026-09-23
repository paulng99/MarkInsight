import { NextResponse } from "next/server";
import { jsonError, AppError } from "@/lib/errors";
import { requireSessionUser } from "@/lib/api/session";
import {
  listClassStudentsForExam,
  uploadSubmissionScript,
} from "@/lib/exams/service";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ examId: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    const user = await requireSessionUser();
    const { examId } = await context.params;

    if (user.role === "TEACHER") {
      const students = await listClassStudentsForExam(user, examId);
      return NextResponse.json({
        students: students.map((s) => ({
          enrollmentId: s.id,
          studentId: s.user.id,
          name: s.user.name,
          email: s.user.email,
          submission: s.submissions[0]
            ? { id: s.submissions[0].id, status: s.submissions[0].status }
            : null,
        })),
      });
    }

    if (user.role === "STUDENT") {
      const schoolId = user.schoolId;
      if (!schoolId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const submission = await prisma.submission.findFirst({
        where: { examId, studentId: user.id, schoolId },
      });
      return NextResponse.json({
        submission: submission
          ? {
              id: submission.id,
              status: submission.status,
              errorMessage: submission.errorMessage,
            }
          : null,
      });
    }

    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } catch (error) {
    const { body, status } = jsonError(error, "Could not list submissions", 500);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request, context: Ctx) {
  try {
    const user = await requireSessionUser();
    const { examId } = await context.params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new AppError("請檢查檔案", 400, "missing_file");
    }
    const studentId = form.get("studentId")
      ? String(form.get("studentId"))
      : undefined;
    const startAnalysis = form.get("analyze") !== "false";

    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await uploadSubmissionScript({
      actor: user,
      examId,
      studentId,
      fileName: file.name || "script",
      mimeType: file.type || "application/octet-stream",
      bytes,
      startAnalysis,
    });

    return NextResponse.json({
      submission: {
        id: result.submission.id,
        status: result.submission.status,
      },
      asset: {
        id: result.asset.id,
        originalName: result.asset.originalName,
      },
      job: result.job,
    });
  } catch (error) {
    const { body, status } = jsonError(error, "請檢查檔案", 500);
    return NextResponse.json(body, { status });
  }
}
