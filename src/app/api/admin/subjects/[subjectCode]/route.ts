import { auth } from "@/auth";
import {
  deleteSubject,
  setSubjectArchived,
} from "@/lib/admin/class-subjects";
import { jsonError } from "@/lib/errors";
import {
  assertCanAccessSchoolSettings,
  resolveAdminSchoolId,
} from "@/lib/school-settings";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ subjectCode: string }> };

/**
 * Admin-only: archive / restore / delete all classes under a subject code.
 */

export async function PATCH(request: Request, context: Ctx) {
  const session = await auth();
  try {
    assertCanAccessSchoolSettings(session?.user?.role);
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { subjectCode } = await context.params;
  let body: { archived?: boolean; schoolId?: string };
  try {
    body = (await request.json()) as { archived?: boolean; schoolId?: string };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.archived !== "boolean") {
    return NextResponse.json({ error: "archived required" }, { status: 400 });
  }

  const schoolId = resolveAdminSchoolId(
    session?.user?.schoolId,
    body.schoolId,
  );

  try {
    const result = await setSubjectArchived(
      schoolId,
      decodeURIComponent(subjectCode),
      body.archived,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const { body: errBody, status } = jsonError(
      error,
      "Could not update subject",
      500,
    );
    return NextResponse.json(errBody, { status });
  }
}

export async function DELETE(request: Request, context: Ctx) {
  const session = await auth();
  try {
    assertCanAccessSchoolSettings(session?.user?.role);
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { subjectCode } = await context.params;
  const { searchParams } = new URL(request.url);
  let bodySchoolId: string | null = null;
  try {
    const body = (await request.json()) as { schoolId?: string };
    bodySchoolId = body.schoolId ?? null;
  } catch {
    // empty body ok
  }
  const schoolId = resolveAdminSchoolId(
    session?.user?.schoolId,
    bodySchoolId ?? searchParams.get("schoolId"),
  );

  try {
    const result = await deleteSubject(
      schoolId,
      decodeURIComponent(subjectCode),
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const { body: errBody, status } = jsonError(
      error,
      "Could not delete subject",
      500,
    );
    return NextResponse.json(errBody, { status });
  }
}
