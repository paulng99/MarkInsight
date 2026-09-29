import { auth } from "@/auth";
import { listSystemPrompts, saveSystemPrompts } from "@/lib/llm/system-prompts";
import {
  assertCanAccessSchoolSettings,
  getAnalysisLlmModel,
  listAnalysisModelChoices,
  resolveAdminSchoolId,
  updateAnalysisLlmModel,
} from "@/lib/school-settings";
import type { SystemPromptSettingDto } from "@/lib/school-settings/types";
import { NextResponse } from "next/server";

export async function PUT(request: Request) {
  const session = await auth();
  try {
    assertCanAccessSchoolSettings(session?.user?.role);
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: {
    schoolId?: string;
    systemPrompts?: SystemPromptSettingDto[];
    analysisLlmModel?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const schoolId = resolveAdminSchoolId(session?.user?.schoolId, body.schoolId);
  if (!body.systemPrompts) {
    return NextResponse.json({ error: "invalid_prompt" }, { status: 400 });
  }

  try {
    const systemPrompts = await saveSystemPrompts(schoolId, body.systemPrompts);
    let analysisLlmModel = await getAnalysisLlmModel(schoolId);
    if (typeof body.analysisLlmModel === "string" && body.analysisLlmModel.trim()) {
      analysisLlmModel = await updateAnalysisLlmModel(
        schoolId,
        body.analysisLlmModel,
      );
    }
    return NextResponse.json({ ok: true, systemPrompts, analysisLlmModel });
  } catch (error) {
    const message = error instanceof Error ? error.message : "validation_failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const session = await auth();
  try {
    assertCanAccessSchoolSettings(session?.user?.role);
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const schoolId = resolveAdminSchoolId(
    session?.user?.schoolId,
    searchParams.get("schoolId"),
  );
  const [systemPrompts, analysisLlmModel, models] = await Promise.all([
    listSystemPrompts(schoolId),
    getAnalysisLlmModel(schoolId),
    listAnalysisModelChoices(),
  ]);
  return NextResponse.json({
    systemPrompts,
    analysisLlmModel,
    models,
  });
}
