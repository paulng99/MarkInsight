import { auth } from "@/auth";
import { listSystemPrompts } from "@/lib/llm/system-prompts";
import {
  assertCanAccessSchoolSettings,
  getSchoolSettingsPage,
  tryResolveAdminSchoolId,
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
  const resolved = tryResolveAdminSchoolId(
    session?.user?.schoolId,
    searchParams.get("schoolId"),
  );
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error, code: resolved.code },
      { status: resolved.status },
    );
  }

  try {
    const page = await getSchoolSettingsPage(resolved.schoolId);
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

  const resolved = tryResolveAdminSchoolId(
    session?.user?.schoolId,
    body.schoolId,
  );
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error, code: resolved.code },
      { status: resolved.status },
    );
  }

  try {
    const settings = await upsertSchoolSettings({
      ...body,
      schoolId: resolved.schoolId,
    });
    const systemPrompts = await listSystemPrompts(resolved.schoolId);
    return NextResponse.json({ ok: true, settings, systemPrompts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "validation_failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
