import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/api/session";
import { jsonError } from "@/lib/errors";
import { archiveClass } from "@/lib/subjects/archive";

type Ctx = { params: Promise<{ classSubjectId: string }> };

export async function POST(_request: Request, context: Ctx) {
  try {
    const user = await requireSessionUser();
    const { classSubjectId } = await context.params;
    await archiveClass(user, classSubjectId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { body, status } = jsonError(error, "Could not archive class", 500);
    return NextResponse.json(body, { status });
  }
}
