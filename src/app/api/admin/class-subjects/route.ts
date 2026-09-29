import { auth } from "@/auth";
import {
  archiveAllClassSubjects,
  deleteAllArchivedClassSubjects,
  listAdminSubjectGroups,
} from "@/lib/admin/class-subjects";
import { jsonError } from "@/lib/errors";
import {
  assertCanAccessSchoolSettings,
  resolveAdminSchoolId,
} from "@/lib/school-settings";
import { NextResponse } from "next/server";

/**
 * Admin-only: list all subjects/classes for a school, or bulk archive/delete.
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
    const subjects = await listAdminSubjectGroups(schoolId);
    return NextResponse.json({ schoolId, subjects });
  } catch (error) {
    const { body, status } = jsonError(error, "Could not list subjects", 500);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  try {
    assertCanAccessSchoolSettings(session?.user?.role);
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { action?: string; schoolId?: string };
  try {
    body = (await request.json()) as { action?: string; schoolId?: string };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const schoolId = resolveAdminSchoolId(
    session?.user?.schoolId,
    body.schoolId,
  );

  try {
    if (body.action === "archive_all") {
      const result = await archiveAllClassSubjects(schoolId);
      return NextResponse.json({ ok: true, ...result });
    }
    if (body.action === "delete_archived") {
      const result = await deleteAllArchivedClassSubjects(schoolId);
      return NextResponse.json({ ok: true, ...result });
    }
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  } catch (error) {
    const { body: errBody, status } = jsonError(
      error,
      "Could not update subjects",
      500,
    );
    return NextResponse.json(errBody, { status });
  }
}
