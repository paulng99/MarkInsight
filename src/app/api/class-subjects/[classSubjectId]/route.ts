import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/api/session";
import { jsonError } from "@/lib/errors";
import { deleteArchivedClass } from "@/lib/subjects/archive";

type Ctx = { params: Promise<{ classSubjectId: string }> };

export async function DELETE(request: Request, context: Ctx) {
  try {
    const user = await requireSessionUser();
    const { classSubjectId } = await context.params;
    let confirm: unknown;
    try {
      const body = (await request.json()) as { confirm?: unknown };
      confirm = body.confirm;
    } catch {
      confirm = undefined;
    }
    await deleteArchivedClass(user, classSubjectId, { confirm });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { body, status } = jsonError(error, "Could not delete class", 500);
    return NextResponse.json(body, { status });
  }
}
