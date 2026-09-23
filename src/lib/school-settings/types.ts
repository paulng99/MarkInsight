/**
 * School settings types (admin-only).
 *
 * OpenRouter / Jina API keys are NEVER part of this shape — env-only.
 * Teachers and students must not read or write settings APIs.
 */

export type SchoolSettingsDto = {
  schoolId: string;
  displayName: string;
  contactNote: string | null;
  /** FK to SchoolYear; year name example "2026-2027". */
  defaultSchoolYearId: string | null;
  /** Denormalized year name for UI stubs (optional). */
  defaultSchoolYearName?: string | null;
  /**
   * Must be a member of OPENROUTER_MODEL_ALLOWLIST.
   * New analysis jobs use this; past results keep their stored llmModel.
   */
  analysisLlmModel: string;
  allowTeacherCreateStudents: boolean;
  allowTeacherUploadOnBehalf: boolean;
};

export type UpsertSchoolSettingsInput = {
  schoolId: string;
  displayName: string;
  contactNote?: string | null;
  defaultSchoolYearId?: string | null;
  analysisLlmModel: string;
  allowTeacherCreateStudents: boolean;
  allowTeacherUploadOnBehalf: boolean;
};
