import { auth } from "@/auth";
import { listSystemPrompts } from "@/lib/llm/system-prompts";
import {
  assertCanAccessSchoolSettings,
  getSchoolSettingsPage,
  resolveAdminSchoolId,
  upsertSchoolSettings,
} from "@/lib/school-settings";
import type { UpsertSchoolSettingsInput } from "@/lib/school-settings/types";
import { NextResponse } from "next/server";

/**
 * Admin-only school settings API.
 *
 * Hard rules: admin-only; never accept/return API keys.
 * Teachers/students receive 403.
 * New jobs read analysisLlmModel; past llmModel columns are never rewritten.
 */

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

  try {
    const page = await getSchoolSettingsPage(schoolId);
    return NextResponse.json(page);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed_to_load_settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
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

  const schoolId = resolveAdminSchoolId(
    session?.user?.schoolId,
    body.schoolId,
  );

  try {
    const settings = await upsertSchoolSettings({ ...body, schoolId });
    const systemPrompts = await listSystemPrompts(schoolId);
    return NextResponse.json({ ok: true, settings, systemPrompts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "validation_failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
