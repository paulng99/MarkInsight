/**
 * School settings access helpers (scaffold).
 *
 * TODO: Wire Prisma SchoolSettings CRUD with assertAllowedAnalysisModel.
 * TODO: Enforce admin-only on every settings route/server action.
 * Hard rule: never return or accept API keys; never persist keys in DB.
 */

import type { Role } from "@/lib/roles";
import {
  assertAllowedAnalysisModel,
  getOpenRouterModelAllowlist,
} from "@/lib/config/openrouter-model-allowlist";
import type {
  SchoolSettingsDto,
  UpsertSchoolSettingsInput,
} from "@/lib/school-settings/types";

export function canAccessSchoolSettings(role: Role | undefined | null): boolean {
  return role === "ADMIN";
}

export function assertCanAccessSchoolSettings(
  role: Role | undefined | null,
): void {
  if (!canAccessSchoolSettings(role)) {
    throw new Error("Forbidden: school settings are admin-only");
  }
}

/** Validate write payload (allowlist + shape). Does not touch the DB. */
export function validateUpsertSchoolSettings(
  input: UpsertSchoolSettingsInput,
): UpsertSchoolSettingsInput {
  const displayName = input.displayName.trim();
  if (!displayName) {
    throw new Error("displayName is required");
  }
  assertAllowedAnalysisModel(input.analysisLlmModel);
  return {
    ...input,
    displayName,
    contactNote: input.contactNote?.trim() || null,
    defaultSchoolYearId: input.defaultSchoolYearId ?? null,
  };
}

export function listAnalysisModelChoices(): string[] {
  return getOpenRouterModelAllowlist();
}

// Re-export types for convenient imports
export type { SchoolSettingsDto, UpsertSchoolSettingsInput };
