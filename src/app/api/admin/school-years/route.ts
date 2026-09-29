import { auth } from "@/auth";
import {
  assertCanAccessSchoolSettings,
  createSchoolYear,
  tryResolveAdminSchoolId,
} from "@/lib/school-settings";
import type { CreateSchoolYearInput } from "@/lib/school-settings/types";
import { NextResponse } from "next/server";

/**
 * Admin-only: create a SchoolYear for the school (MVP helper for settings).
 * Dates are yyyy-mm-dd; name like "2026-2027" derives Sept–Aug when dates omitted.
 */

export async function POST(request: Request) {
  const session = await auth();
  try {
    assertCanAccessSchoolSettings(session?.user?.role);
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: CreateSchoolYearInput;
  try {
    body = (await request.json()) as CreateSchoolYearInput;
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
    const year = await createSchoolYear({
      ...body,
      schoolId: resolved.schoolId,
    });
    return NextResponse.json({ ok: true, year }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "create_failed";
    const status =
      message.includes("Unique") || message.toLowerCase().includes("unique")
        ? 409
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
