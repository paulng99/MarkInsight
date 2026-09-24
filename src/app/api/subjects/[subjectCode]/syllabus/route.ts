import { NextResponse } from "next/server";
import { AppError, jsonError } from "@/lib/errors";
import { requireSessionUser } from "@/lib/api/session";
import { uploadSubjectSyllabus } from "@/lib/subjects/syllabus";

type Ctx = { params: Promise<{ subjectCode: string }> };

export async function POST(request: Request, context: Ctx) {
  try {
    const user = await requireSessionUser();
    if (user.role !== "TEACHER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { subjectCode } = await context.params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new AppError("請檢查檔案", 400, "missing_file");
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const row = await uploadSubjectSyllabus({
      user,
      subjectCode: decodeURIComponent(subjectCode),
      fileName: file.name || "syllabus",
      mimeType: file.type || "application/octet-stream",
      bytes,
    });
    return NextResponse.json({
      syllabus: {
        subjectCode: row.subjectCode,
        originalName: row.originalName,
        mimeType: row.mimeType,
      },
    });
  } catch (error) {
    const { body, status } = jsonError(error, "請檢查檔案", 500);
    return NextResponse.json(body, { status });
  }
}
