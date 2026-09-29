import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/api/session";
import { jsonError } from "@/lib/errors";
import { restoreSubject } from "@/lib/subjects/archive";

type Ctx = { params: Promise<{ subjectCode: string }> };

export async function POST(_request: Request, context: Ctx) {
  try {
    const user = await requireSessionUser();
    const { subjectCode } = await context.params;
    await restoreSubject(user, decodeURIComponent(subjectCode));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { body, status } = jsonError(error, "Could not restore subject", 500);
    return NextResponse.json(body, { status });
  }
}
