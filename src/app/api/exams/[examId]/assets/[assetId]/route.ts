import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/api/session";
import { jsonError } from "@/lib/errors";
import { assertTeacherOwnsExam, deleteExamAsset } from "@/lib/exams/service";
import { getObjectBytes } from "@/lib/storage";

type Ctx = { params: Promise<{ examId: string; assetId: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    const user = await requireSessionUser();
    const { examId, assetId } = await context.params;
    const exam = await assertTeacherOwnsExam(user, examId);
    const asset = exam.assets.find((row) => row.id === assetId);
    if (!asset) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    const bytes = await getObjectBytes(asset.storageKey);
    const mime = asset.mimeType || "application/octet-stream";
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    const { body, status } = jsonError(error, "Could not open file", 500);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  try {
    const user = await requireSessionUser();
    const { examId, assetId } = await context.params;
    await deleteExamAsset(user, examId, assetId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { body, status } = jsonError(error, "Could not delete file", 500);
    return NextResponse.json(body, { status });
  }
}
