import { auth } from "@/auth";
import {
  archiveAllClassSubjects,
  deleteAllArchivedClassSubjects,
  listAdminSubjectGroups,
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

/**
 * Admin-only: list all subjects/classes for a school, or bulk archive/delete.
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
    const subjects = await listAdminSubjectGroups(resolved.schoolId);
    return NextResponse.json({ schoolId: resolved.schoolId, subjects });
  } catch (error) {
    const { body, status } = jsonError(error, "Could not list subjects", 500);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request) {
  const session = await auth();

  let body: {
    action?: string;
    schoolId?: string;
    confirm?: unknown;
    expectedClasses?: unknown;
    expectedExams?: unknown;
    expectedSubmissions?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const isBulkDelete = body.action === "delete_archived";

  try {
    assertCanAccessSchoolSettings(session?.user?.role);
  } catch {
    if (isBulkDelete) return opaqueDeleteForbidden();
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const resolved = tryResolveAdminSchoolId(
    session?.user?.schoolId,
    body.schoolId,
  );
  if (!resolved.ok) {
    if (isBulkDelete) return opaqueDeleteForbidden();
    return NextResponse.json(
      { error: resolved.error, code: resolved.code },
      { status: resolved.status },
    );
  }

  try {
    if (body.action === "archive_all") {
      const result = await archiveAllClassSubjects(resolved.schoolId);
      return NextResponse.json({ ok: true, ...result });
    }
    if (body.action === "delete_archived") {
      const result = await deleteAllArchivedClassSubjects(resolved.schoolId, {
        confirm: body.confirm,
        expectedClasses: body.expectedClasses,
        expectedExams: body.expectedExams,
        expectedSubmissions: body.expectedSubmissions,
      });
      return NextResponse.json({ ok: true, ...result });
    }
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  } catch (error) {
    if (body.action === "delete_archived") {
      const { body: errBody, status } = jsonError(
        error,
        ADMIN_DELETE_REJECTED_MESSAGE_EN,
        400,
      );
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
    const { body: errBody, status } = jsonError(
      error,
      "Could not update subjects",
      500,
    );
    return NextResponse.json(errBody, { status });
  }
}
