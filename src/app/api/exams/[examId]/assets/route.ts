import { NextResponse } from "next/server";
import type { AssetKind } from "@prisma/client";
import { jsonError, AppError } from "@/lib/errors";
import { requireSessionUser } from "@/lib/api/session";
import { uploadExamAsset } from "@/lib/exams/service";

type Ctx = { params: Promise<{ examId: string }> };

const KIND_SET = new Set<AssetKind>([
  "QUESTION_PAPER",
  "ANSWER_KEY",
  "STUDENT_SCRIPT",
  "OTHER",
]);

export async function POST(request: Request, context: Ctx) {
  try {
    const user = await requireSessionUser();
    if (user.role !== "TEACHER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { examId } = await context.params;
    const form = await request.formData();
    const file = form.get("file");
    const kindRaw = String(form.get("kind") || "QUESTION_PAPER");
    if (!(file instanceof File)) {
      throw new AppError("請檢查檔案", 400, "missing_file");
    }
    if (!KIND_SET.has(kindRaw as AssetKind)) {
      throw new AppError("Invalid asset kind", 400, "invalid_kind");
    }
    const kind = kindRaw as AssetKind;
    if (kind === "STUDENT_SCRIPT") {
      throw new AppError(
        "Use the submission upload endpoint for answer scripts",
        400,
        "wrong_endpoint",
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const asset = await uploadExamAsset(user, examId, {
      kind,
      fileName: file.name || "upload",
      mimeType: file.type || "application/octet-stream",
      bytes,
    });

    return NextResponse.json({
      asset: {
        id: asset.id,
        kind: asset.kind,
        originalName: asset.originalName,
        mimeType: asset.mimeType,
      },
    });
  } catch (error) {
    const { body, status } = jsonError(error, "請檢查檔案", 500);
    return NextResponse.json(body, { status });
  }
}
