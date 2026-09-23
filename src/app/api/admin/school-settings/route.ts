import { auth } from "@/auth";
import {
  assertCanAccessSchoolSettings,
  listAnalysisModelChoices,
  validateUpsertSchoolSettings,
} from "@/lib/school-settings";
import type { UpsertSchoolSettingsInput } from "@/lib/school-settings/types";
import { NextResponse } from "next/server";

/**
 * Admin-only school settings API stub.
 *
 * TODO: Load/upsert Prisma SchoolSettings by schoolId.
 * Hard rules: admin-only; never accept/return OPENROUTER_API_KEY or JINA_API_KEY.
 * Teachers/students must receive 403.
 */

export async function GET(request: Request) {
  const session = await auth();
  try {
    assertCanAccessSchoolSettings(session?.user?.role);
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const schoolId = searchParams.get("schoolId");
  if (!schoolId) {
    return NextResponse.json({ error: "schoolId required" }, { status: 400 });
  }

  // Scaffold: no DB read yet — return empty stub + allowlist for the settings UI.
  return NextResponse.json({
    settings: null as null,
    schoolId,
    analysisModelAllowlist: listAnalysisModelChoices(),
    // TODO: return SchoolSettingsDto from Prisma
  });
}

export async function PUT(request: Request) {
  const session = await auth();
  try {
    assertCanAccessSchoolSettings(session?.user?.role);
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: UpsertSchoolSettingsInput;
  try {
    body = (await request.json()) as UpsertSchoolSettingsInput;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    const validated = validateUpsertSchoolSettings(body);
    // TODO: prisma.schoolSettings.upsert({ where: { schoolId }, ...validated })
    // New jobs must read analysisLlmModel; do not rewrite past llmModel columns.
    return NextResponse.json({
      ok: true,
      stub: true,
      settings: validated,
      message:
        "School settings validated (scaffold stub — persist via Prisma in a follow-up).",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "validation_failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
