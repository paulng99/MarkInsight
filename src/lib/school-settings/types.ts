/**
 * School settings types (admin-only).
 *
 * Analysis / embedding API keys are NEVER part of this shape — env-only.
 * Teachers and students must not read or write settings APIs.
 */

export type SchoolYearDto = {
  id: string;
  name: string;
  /** yyyy-mm-dd */
  startsOn: string;
  /** yyyy-mm-dd */
  endsOn: string;
};

export type TeacherAccountDto = {
  id: string;
  email: string;
  name: string | null;
};

export type SchoolSettingsDto = {
  schoolId: string;
  displayName: string;
  contactNote: string | null;
  /** FK to SchoolYear; year name example "2026-2027". */
  defaultSchoolYearId: string | null;
  /** Denormalized year name for UI. */
  defaultSchoolYearName?: string | null;
  /**
   * Must be a member of the analysis model allowlist.
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

/** Full admin settings page payload (GET). */
export type SchoolSettingsPageDto = {
  schoolId: string;
  schoolName: string;
  settings: SchoolSettingsDto | null;
  schoolYears: SchoolYearDto[];
  teachers: TeacherAccountDto[];
  analysisModelAllowlist: string[];
};

export type CreateTeacherInput = {
  schoolId: string;
  email: string;
  name: string;
};

export type CreateSchoolYearInput = {
  schoolId: string;
  /** e.g. "2026-2027" */
  name: string;
  /** yyyy-mm-dd; optional — derived from name when omitted */
  startsOn?: string;
  /** yyyy-mm-dd; optional — derived from name when omitted */
  endsOn?: string;
};
