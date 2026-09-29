import { auth } from "@/auth";
import {
  assertCanAccessSchoolSettings,
  createTeacherAccount,
  listTeachersForSchool,
  tryResolveAdminSchoolId,
} from "@/lib/school-settings";
import type { CreateTeacherInput } from "@/lib/school-settings/types";
import { NextResponse } from "next/server";

/**
 * Admin-only teacher account management for a school (MVP).
 * Create returns a one-time temporaryPassword (never logged; not stored in plaintext).
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
    const teachers = await listTeachersForSchool(resolved.schoolId);
    return NextResponse.json({ schoolId: resolved.schoolId, teachers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "list_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  try {
    assertCanAccessSchoolSettings(session?.user?.role);
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: CreateTeacherInput;
  try {
    body = (await request.json()) as CreateTeacherInput;
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
    const teacher = await createTeacherAccount({
      ...body,
      schoolId: resolved.schoolId,
    });
    // temporaryPassword is in the JSON body — never cache this response.
    return NextResponse.json(
      { ok: true, teacher },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "create_failed";
    const status = message.includes("already exists") ? 409 : 400;
    return NextResponse.json(
      { error: message },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
