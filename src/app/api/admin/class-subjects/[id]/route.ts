import { auth } from "@/auth";
import {
  deleteClassSubject,
  setClassArchived,
} from "@/lib/admin/class-subjects";
import { jsonError } from "@/lib/errors";
import {
  assertCanAccessSchoolSettings,
  tryResolveAdminSchoolId,
} from "@/lib/school-settings";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Admin-only: archive / restore / delete one class (ClassSubject).
 */

export async function PATCH(request: Request, context: Ctx) {
  const session = await auth();
  try {
    assertCanAccessSchoolSettings(session?.user?.role);
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
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
    const row = await setClassArchived(resolved.schoolId, id, body.archived);
    return NextResponse.json({
      ok: true,
      classSubject: {
        id: row.id,
        archivedAt: row.archivedAt
          ? row.archivedAt.toISOString().slice(0, 10)
          : null,
      },
    });
  } catch (error) {
    const { body: errBody, status } = jsonError(
      error,
      "Could not update class",
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

  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  let bodySchoolId: string | null = null;
  let confirm: unknown;
  try {
    const body = (await request.json()) as {
      schoolId?: string;
      confirm?: unknown;
    };
    bodySchoolId = body.schoolId ?? null;
    confirm = body.confirm;
  } catch {
    // DELETE may have an empty body when there is no protected data
  }
  const resolved = tryResolveAdminSchoolId(
    session?.user?.schoolId,
    bodySchoolId ?? searchParams.get("schoolId"),
  );
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error, code: resolved.code },
      { status: resolved.status },
    );
  }

  try {
    await deleteClassSubject(resolved.schoolId, id, confirm);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { body: errBody, status } = jsonError(
      error,
      "Could not delete class",
      500,
    );
    return NextResponse.json(errBody, { status });
  }
}
