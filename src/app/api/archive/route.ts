import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/api/session";
import { jsonError } from "@/lib/errors";
import { listArchivedSubjects } from "@/lib/subjects/archive";

export async function GET() {
  try {
    const user = await requireSessionUser();
    const subjects = await listArchivedSubjects(user);
    return NextResponse.json({ subjects });
  } catch (error) {
    const { body, status } = jsonError(error, "Could not list archive", 500);
    return NextResponse.json(body, { status });
  }
}
