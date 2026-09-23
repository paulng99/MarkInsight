import { NextResponse } from "next/server";
import { jsonError } from "@/lib/errors";
import { requireSessionUser } from "@/lib/api/session";
import {
  createExam,
  formatDateYmd,
  listExamsForStudent,
  listExamsForTeacher,
} from "@/lib/exams/service";
import { ensureStudentWorkspace, ensureTeacherWorkspace } from "@/lib/demo-bootstrap";
import { DEMO_SCHOOL_ID } from "@/lib/school-settings";

export async function GET() {
  try {
    const user = await requireSessionUser();
    const schoolId = user.schoolId ?? DEMO_SCHOOL_ID;

    if (user.role === "TEACHER") {
      await ensureTeacherWorkspace({
        userId: user.id,
        email: user.email,
        name: user.name,
        schoolId,
      });
      const exams = await listExamsForTeacher(user);
      return NextResponse.json({
        exams: exams.map((e) => ({
          id: e.id,
          title: e.title,
          examDate: formatDateYmd(e.examDate),
          classSubject: e.classSubject,
          assetCount: e._count.assets,
          submissionCount: e._count.submissions,
          structureLlmModel: e.structureLlmModel,
          latestStructureJob: e.analysisJobs[0]
            ? {
                id: e.analysisJobs[0].id,
                status: e.analysisJobs[0].status,
                errorMessage: e.analysisJobs[0].errorMessage,
              }
            : null,
        })),
      });
    }

    if (user.role === "STUDENT") {
      await ensureStudentWorkspace({
        userId: user.id,
        email: user.email,
        name: user.name,
        schoolId,
      });
      const exams = await listExamsForStudent(user);
      return NextResponse.json({
        exams: exams.map((e) => ({
          id: e.id,
          title: e.title,
          examDate: formatDateYmd(e.examDate),
          classSubject: e.classSubject,
          submission: e.submissions[0]
            ? {
                id: e.submissions[0].id,
                status: e.submissions[0].status,
                scoringLlmModel: e.submissions[0].scoringLlmModel,
                latestJob: e.submissions[0].analysisJobs[0]
                  ? {
                      id: e.submissions[0].analysisJobs[0].id,
                      status: e.submissions[0].analysisJobs[0].status,
                    }
                  : null,
              }
            : null,
        })),
      });
    }

    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } catch (error) {
    const { body, status } = jsonError(error, "Could not list exams", 500);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    if (user.role !== "TEACHER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const schoolId = user.schoolId ?? DEMO_SCHOOL_ID;
    await ensureTeacherWorkspace({
      userId: user.id,
      email: user.email,
      name: user.name,
      schoolId,
    });

    const body = (await request.json()) as {
      classSubjectId?: string;
      title?: string;
      examDate?: string;
    };
    if (!body.classSubjectId || !body.title || !body.examDate) {
      return NextResponse.json(
        { error: "classSubjectId, title, and examDate are required" },
        { status: 400 },
      );
    }

    const exam = await createExam(user, {
      classSubjectId: body.classSubjectId,
      title: body.title,
      examDate: body.examDate,
    });

    return NextResponse.json({
      exam: {
        id: exam.id,
        title: exam.title,
        examDate: formatDateYmd(exam.examDate),
        classSubjectId: exam.classSubjectId,
      },
    });
  } catch (error) {
    const { body, status } = jsonError(error, "Could not create exam", 500);
    return NextResponse.json(body, { status });
  }
}
