import { auth } from "@/auth";
import {
  assertCanAccessSchoolSettings,
  createTeacherAccount,
  listTeachersForSchool,
  resolveAdminSchoolId,
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
  const schoolId = resolveAdminSchoolId(
    session?.user?.schoolId,
    searchParams.get("schoolId"),
  );

  try {
    const teachers = await listTeachersForSchool(schoolId);
    return NextResponse.json({ schoolId, teachers });
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

  const schoolId = resolveAdminSchoolId(
    session?.user?.schoolId,
    body.schoolId,
  );

  try {
    const teacher = await createTeacherAccount({ ...body, schoolId });
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
