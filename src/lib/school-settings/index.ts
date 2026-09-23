/**
 * School settings access helpers — admin-only Prisma CRUD.
 *
 * Hard rule: never return or accept API keys; never persist keys in DB.
 * New AnalysisJobs must read analysisLlmModel; never rewrite historical llmModel.
 */

import type { Role } from "@/lib/roles";
import {
  assertAllowedAnalysisModel,
  getOpenRouterModelAllowlist,
} from "@/lib/config/openrouter-model-allowlist";
import { prisma } from "@/lib/prisma";
import type {
  CreateSchoolYearInput,
  CreateTeacherInput,
  SchoolSettingsDto,
  SchoolSettingsPageDto,
  SchoolYearDto,
  TeacherAccountDto,
  UpsertSchoolSettingsInput,
} from "@/lib/school-settings/types";
import bcrypt from "bcryptjs";

/** Stub/demo school used when platform admin has no schoolId. */
export const DEMO_SCHOOL_ID = "demo_school";

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

/**
 * Resolve the school an admin is configuring.
 * Platform admins (schoolId null) manage the demo school in the stub.
 */
export function resolveAdminSchoolId(
  sessionSchoolId: string | null | undefined,
  requestedSchoolId?: string | null,
): string {
  if (requestedSchoolId?.trim()) return requestedSchoolId.trim();
  if (sessionSchoolId?.trim()) return sessionSchoolId.trim();
  return DEMO_SCHOOL_ID;
}

function formatDateYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseYmd(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) {
    throw new Error(`Invalid date "${value}" — use yyyy-mm-dd`);
  }
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date "${value}" — use yyyy-mm-dd`);
  }
  return date;
}

/** HK-style academic year dates from "YYYY-YYYY" name (Sept → Aug). */
export function datesFromSchoolYearName(name: string): {
  startsOn: Date;
  endsOn: Date;
} {
  const m = /^(\d{4})\s*[-–]\s*(\d{4})$/.exec(name.trim());
  if (!m) {
    throw new Error(
      'School year name must look like "2026-2027" (startYear-endYear)',
    );
  }
  const startYear = Number(m[1]);
  const endYear = Number(m[2]);
  if (endYear !== startYear + 1) {
    throw new Error("School year end must be start year + 1");
  }
  return {
    startsOn: new Date(Date.UTC(startYear, 8, 1)), // Sept 1
    endsOn: new Date(Date.UTC(endYear, 7, 31)), // Aug 31
  };
}

function currentHkSchoolYearName(now = new Date()): string {
  const y = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-based
  // Before September → previous start year
  const startYear = month >= 8 ? y : y - 1;
  return `${startYear}-${startYear + 1}`;
}

function toSchoolYearDto(row: {
  id: string;
  name: string;
  startsOn: Date;
  endsOn: Date;
}): SchoolYearDto {
  return {
    id: row.id,
    name: row.name,
    startsOn: formatDateYmd(row.startsOn),
    endsOn: formatDateYmd(row.endsOn),
  };
}

function toSettingsDto(row: {
  schoolId: string;
  displayName: string;
  contactNote: string | null;
  defaultSchoolYearId: string | null;
  analysisLlmModel: string;
  allowTeacherCreateStudents: boolean;
  allowTeacherUploadOnBehalf: boolean;
  defaultSchoolYear?: { name: string } | null;
}): SchoolSettingsDto {
  return {
    schoolId: row.schoolId,
    displayName: row.displayName,
    contactNote: row.contactNote,
    defaultSchoolYearId: row.defaultSchoolYearId,
    defaultSchoolYearName: row.defaultSchoolYear?.name ?? null,
    analysisLlmModel: row.analysisLlmModel,
    allowTeacherCreateStudents: row.allowTeacherCreateStudents,
    allowTeacherUploadOnBehalf: row.allowTeacherUploadOnBehalf,
  };
}

/** Ensure school + default year + settings exist for local/demo admin flow. */
export async function ensureSchoolBootstrap(
  schoolId: string,
): Promise<{ schoolName: string }> {
  const allowlist = getOpenRouterModelAllowlist();
  const defaultModel = allowlist[0];
  if (!defaultModel) {
    throw new Error("Analysis model allowlist is empty");
  }

  const school = await prisma.school.upsert({
    where: { id: schoolId },
    create: {
      id: schoolId,
      name: schoolId === DEMO_SCHOOL_ID ? "Demo School" : "School",
    },
    update: {},
  });

  let years = await prisma.schoolYear.findMany({
    where: { schoolId },
    orderBy: { startsOn: "desc" },
  });

  if (years.length === 0) {
    const yearName = currentHkSchoolYearName();
    const { startsOn, endsOn } = datesFromSchoolYearName(yearName);
    await prisma.schoolYear.create({
      data: { schoolId, name: yearName, startsOn, endsOn },
    });
    years = await prisma.schoolYear.findMany({
      where: { schoolId },
      orderBy: { startsOn: "desc" },
    });
  }

  const existing = await prisma.schoolSettings.findUnique({
    where: { schoolId },
  });

  if (!existing) {
    await prisma.schoolSettings.create({
      data: {
        schoolId,
        displayName: school.name,
        contactNote: null,
        defaultSchoolYearId: years[0]?.id ?? null,
        analysisLlmModel: defaultModel,
        allowTeacherCreateStudents: false,
        allowTeacherUploadOnBehalf: false,
      },
    });
  }

  return { schoolName: school.name };
}

export async function getSchoolSettingsPage(
  schoolId: string,
): Promise<SchoolSettingsPageDto> {
  const { schoolName } = await ensureSchoolBootstrap(schoolId);

  const [settings, schoolYears, teachers] = await Promise.all([
    prisma.schoolSettings.findUnique({
      where: { schoolId },
      include: { defaultSchoolYear: { select: { name: true } } },
    }),
    prisma.schoolYear.findMany({
      where: { schoolId },
      orderBy: { startsOn: "desc" },
    }),
    prisma.user.findMany({
      where: { schoolId, role: "TEACHER" },
      orderBy: { email: "asc" },
      select: { id: true, email: true, name: true },
    }),
  ]);

  return {
    schoolId,
    schoolName,
    settings: settings ? toSettingsDto(settings) : null,
    schoolYears: schoolYears.map(toSchoolYearDto),
    teachers: teachers as TeacherAccountDto[],
    analysisModelAllowlist: listAnalysisModelChoices(),
  };
}

/** Validate write payload (allowlist + shape). Does not touch the DB. */
export function validateUpsertSchoolSettings(
  input: UpsertSchoolSettingsInput,
): UpsertSchoolSettingsInput {
  const displayName = input.displayName.trim();
  if (!displayName) {
    throw new Error("displayName is required");
  }
  if (!input.schoolId?.trim()) {
    throw new Error("schoolId is required");
  }
  assertAllowedAnalysisModel(input.analysisLlmModel);
  return {
    ...input,
    schoolId: input.schoolId.trim(),
    displayName,
    contactNote: input.contactNote?.trim() || null,
    defaultSchoolYearId: input.defaultSchoolYearId ?? null,
    allowTeacherCreateStudents: Boolean(input.allowTeacherCreateStudents),
    allowTeacherUploadOnBehalf: Boolean(input.allowTeacherUploadOnBehalf),
  };
}

export async function upsertSchoolSettings(
  input: UpsertSchoolSettingsInput,
): Promise<SchoolSettingsDto> {
  const validated = validateUpsertSchoolSettings(input);
  await ensureSchoolBootstrap(validated.schoolId);

  if (validated.defaultSchoolYearId) {
    const year = await prisma.schoolYear.findFirst({
      where: {
        id: validated.defaultSchoolYearId,
        schoolId: validated.schoolId,
      },
    });
    if (!year) {
      throw new Error("defaultSchoolYearId does not belong to this school");
    }
  }

  const row = await prisma.schoolSettings.upsert({
    where: { schoolId: validated.schoolId },
    create: {
      schoolId: validated.schoolId,
      displayName: validated.displayName,
      contactNote: validated.contactNote ?? null,
      defaultSchoolYearId: validated.defaultSchoolYearId ?? null,
      analysisLlmModel: validated.analysisLlmModel,
      allowTeacherCreateStudents: validated.allowTeacherCreateStudents,
      allowTeacherUploadOnBehalf: validated.allowTeacherUploadOnBehalf,
    },
    update: {
      displayName: validated.displayName,
      contactNote: validated.contactNote ?? null,
      defaultSchoolYearId: validated.defaultSchoolYearId ?? null,
      analysisLlmModel: validated.analysisLlmModel,
      allowTeacherCreateStudents: validated.allowTeacherCreateStudents,
      allowTeacherUploadOnBehalf: validated.allowTeacherUploadOnBehalf,
    },
    include: { defaultSchoolYear: { select: { name: true } } },
  });

  // Keep School.name aligned with display name for admin convenience (MVP).
  await prisma.school.update({
    where: { id: validated.schoolId },
    data: { name: validated.displayName },
  });

  return toSettingsDto(row);
}

export async function createSchoolYear(
  input: CreateSchoolYearInput,
): Promise<SchoolYearDto> {
  const schoolId = input.schoolId.trim();
  const name = input.name.trim();
  if (!schoolId) throw new Error("schoolId is required");
  if (!name) throw new Error("School year name is required");

  await ensureSchoolBootstrap(schoolId);

  let startsOn: Date;
  let endsOn: Date;
  if (input.startsOn && input.endsOn) {
    startsOn = parseYmd(input.startsOn);
    endsOn = parseYmd(input.endsOn);
  } else {
    ({ startsOn, endsOn } = datesFromSchoolYearName(name));
  }
  if (endsOn <= startsOn) {
    throw new Error("endsOn must be after startsOn");
  }

  try {
    const row = await prisma.schoolYear.create({
      data: { schoolId, name, startsOn, endsOn },
    });
    return toSchoolYearDto(row);
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: unknown }).code)
        : "";
    if (code === "P2002") {
      throw new Error(`School year "${name}" already exists for this school`);
    }
    throw error;
  }
}

/** Stub default password for newly created teacher accounts (dev only). */
const TEACHER_STUB_PASSWORD = "password";

export async function listTeachersForSchool(
  schoolId: string,
): Promise<TeacherAccountDto[]> {
  return prisma.user.findMany({
    where: { schoolId, role: "TEACHER" },
    orderBy: { email: "asc" },
    select: { id: true, email: true, name: true },
  });
}

export async function createTeacherAccount(
  input: CreateTeacherInput,
): Promise<TeacherAccountDto> {
  const schoolId = input.schoolId.trim();
  const email = input.email.toLowerCase().trim();
  const name = input.name.trim();
  if (!schoolId) throw new Error("schoolId is required");
  if (!email || !email.includes("@")) throw new Error("Valid email is required");
  if (!name) throw new Error("Teacher name is required");

  await ensureSchoolBootstrap(schoolId);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("A user with this email already exists");
  }

  const passwordHash = await bcrypt.hash(TEACHER_STUB_PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      email,
      name,
      role: "TEACHER",
      schoolId,
      passwordHash,
    },
    select: { id: true, email: true, name: true },
  });
  return user;
}

/**
 * Resolve the analysis model for a **new** job.
 * Falls back to allowlist[0] if settings row is missing or DB is unavailable.
 * Does not mutate historical Exam/Submission/AnalysisJob model ids.
 */
export async function resolveAnalysisLlmModelForNewJob(
  schoolId: string,
): Promise<string> {
  const allowlist = getOpenRouterModelAllowlist();
  const fallback = allowlist[0];
  if (!fallback) {
    throw new Error("Analysis model allowlist is empty");
  }

  try {
    const settings = await prisma.schoolSettings.findUnique({
      where: { schoolId },
      select: { analysisLlmModel: true },
    });
    if (settings?.analysisLlmModel) {
      assertAllowedAnalysisModel(settings.analysisLlmModel);
      return settings.analysisLlmModel;
    }
  } catch {
    // Stub / offline DB — use allowlist fallback for new jobs.
  }
  return fallback;
}

export function listAnalysisModelChoices(): string[] {
  return getOpenRouterModelAllowlist();
}

export type {
  SchoolSettingsDto,
  SchoolSettingsPageDto,
  SchoolYearDto,
  TeacherAccountDto,
  UpsertSchoolSettingsInput,
  CreateTeacherInput,
  CreateSchoolYearInput,
};
