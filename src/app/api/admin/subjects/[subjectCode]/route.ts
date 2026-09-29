import { auth } from "@/auth";
import {
  deleteSubject,
  setSubjectArchived,
} from "@/lib/admin/class-subjects";
import {
  ADMIN_DELETE_REJECTED_CODE,
  ADMIN_DELETE_REJECTED_MESSAGE_EN,
} from "@/lib/admin/delete-confirm";
import { jsonError } from "@/lib/errors";
import {
  assertCanAccessSchoolSettings,
  tryResolveAdminSchoolId,
} from "@/lib/school-settings";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ subjectCode: string }> };

/**
 * Admin-only: archive / restore / delete all classes under a subject code.
 */

function opaqueDeleteForbidden() {
  return NextResponse.json(
    {
      error: ADMIN_DELETE_REJECTED_MESSAGE_EN,
      code: ADMIN_DELETE_REJECTED_CODE,
    },
    { status: 403 },
  );
}

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
    const result = await setSubjectArchived(
      resolved.schoolId,
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
    return opaqueDeleteForbidden();
  }

  const { subjectCode } = await context.params;
  const { searchParams } = new URL(request.url);
  let bodySchoolId: string | null = null;
  let confirm: unknown;
  let expectedExams: unknown;
  let expectedSubmissions: unknown;
  let expectedAnalysisJobs: unknown;
  try {
    const body = (await request.json()) as {
      schoolId?: string;
      confirm?: unknown;
      expectedExams?: unknown;
      expectedSubmissions?: unknown;
      expectedAnalysisJobs?: unknown;
    };
    bodySchoolId = body.schoolId ?? null;
    confirm = body.confirm;
    expectedExams = body.expectedExams;
    expectedSubmissions = body.expectedSubmissions;
    expectedAnalysisJobs = body.expectedAnalysisJobs;
  } catch {
    // empty body ok for subjects without protected data
  }
  const resolved = tryResolveAdminSchoolId(
    session?.user?.schoolId,
    bodySchoolId ?? searchParams.get("schoolId"),
  );
  if (!resolved.ok) {
    return opaqueDeleteForbidden();
  }

  try {
    const result = await deleteSubject(
      resolved.schoolId,
      decodeURIComponent(subjectCode),
      { confirm, expectedExams, expectedSubmissions, expectedAnalysisJobs },
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const { body: errBody, status } = jsonError(
      error,
      ADMIN_DELETE_REJECTED_MESSAGE_EN,
      400,
    );
    // Never leak not-found / cross-school / confirm details on delete.
    if (
      errBody.code === ADMIN_DELETE_REJECTED_CODE ||
      status === 400 ||
      status === 403 ||
      status === 404
    ) {
      return NextResponse.json(
        {
          error: ADMIN_DELETE_REJECTED_MESSAGE_EN,
          code: ADMIN_DELETE_REJECTED_CODE,
        },
        { status: status === 403 ? 403 : 400 },
      );
    }
    return NextResponse.json(errBody, { status });
  }
}
