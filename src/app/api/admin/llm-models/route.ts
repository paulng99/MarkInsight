import { auth } from "@/auth";
import {
  assertCanAccessSchoolSettings,
  listAnalysisModelChoices,
} from "@/lib/school-settings";
import { NextResponse } from "next/server";

/**
 * Admin-only analysis model catalog.
 * Returns gateway model ids suitable for multimodal exam analysis.
 * Never exposes API keys or vendor brand names in the payload.
 */
export async function GET() {
  const session = await auth();
  try {
    assertCanAccessSchoolSettings(session?.user?.role);
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const models = await listAnalysisModelChoices();
    return NextResponse.json({ models });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed_to_load_models";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
