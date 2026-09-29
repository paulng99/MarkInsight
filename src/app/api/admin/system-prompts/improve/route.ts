import { auth } from "@/auth";
import { jsonError } from "@/lib/errors";
import { improveSystemPrompt } from "@/lib/llm/improve-system-prompt";
import {
  assertCanAccessSchoolSettings,
  resolveAnalysisLlmModelForNewJob,
  tryResolveAdminSchoolId,
} from "@/lib/school-settings";
import { NextResponse } from "next/server";

/**
 * Admin-only: rewrite one system prompt in place. Does not save it.
 */
export async function POST(request: Request) {
  const session = await auth();
  try {
    assertCanAccessSchoolSettings(session?.user?.role);
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { schoolId?: string; key?: string; draft?: string };
  try {
    body = (await request.json()) as typeof body;
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
  if (!body.key || typeof body.draft !== "string") {
    return NextResponse.json({ error: "invalid_prompt" }, { status: 400 });
  }

  try {
    const model = await resolveAnalysisLlmModelForNewJob(resolved.schoolId);
    const prompt = await improveSystemPrompt({
      key: body.key,
      draft: body.draft,
      model,
    });
    return NextResponse.json({ prompt });
  } catch (error) {
    const { body: payload, status } = jsonError(error, "improve_failed", 400);
    return NextResponse.json(payload, { status });
  }
}
