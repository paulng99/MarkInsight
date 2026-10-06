/**
 * Test doubles for teacher-role-permissions.test.ts.
 * Covers archive delete + exam structure analysis helpers.
 */

import { AppError } from "@/lib/errors";
import type { SessionUser } from "@/lib/rbac";

type PermState = {
  ownerId: string;
  classArchived: boolean;
  deleteConfirmOk: boolean;
  deleted: boolean;
  analysisStarted: boolean;
};

function state(): PermState {
  return (globalThis as unknown as { __MI_PERM_STATE__: PermState }).__MI_PERM_STATE__;
}

function requireTeacher(user: SessionUser): void {
  if (user.role !== "TEACHER") {
    throw new AppError("Forbidden", 403, "forbidden");
  }
}

export async function deleteArchivedClass(
  user: SessionUser,
  _classSubjectId: string,
  options: { confirm?: unknown } = {},
) {
  requireTeacher(user);
  if (user.id !== state().ownerId) {
    throw new AppError("Forbidden", 403, "forbidden");
  }
  if (!state().deleteConfirmOk || options.confirm !== "3A") {
    throw new AppError(
      "Could not delete: the data has changed or you do not have permission. Refresh the page and try again.",
      400,
      "delete_rejected",
    );
  }
  state().deleted = true;
}

export async function deleteArchivedSubject() {
  throw new AppError("not used", 500, "unused");
}

export async function startExamStructureAnalysis(user: SessionUser, examId: string) {
  if (user.role !== "TEACHER") {
    throw new AppError("Forbidden", 403, "forbidden");
  }
  if (user.id !== state().ownerId) {
    throw new AppError("Forbidden", 403, "forbidden");
  }
  if (state().classArchived) {
    throw new AppError("此班別已封存，不能再使用。", 409, "class_archived");
  }
  state().analysisStarted = true;
  return { jobId: `job-${examId}`, status: "PENDING" as const };
}

export async function assertTeacherOwnsExam(user: SessionUser, examId: string) {
  if (user.role === "STUDENT") {
    throw new AppError("Forbidden", 403, "forbidden");
  }
  if (user.role === "TEACHER" && user.id !== state().ownerId) {
    throw new AppError("Forbidden", 403, "forbidden");
  }
  if (user.role !== "TEACHER" && user.role !== "ADMIN") {
    throw new AppError("Forbidden", 403, "forbidden");
  }
  return {
    id: examId,
    schoolId: user.schoolId,
    classSubject: {
      id: "cs-1",
      name: "3A",
      archivedAt: null,
      classArchivedAt: state().classArchived ? new Date() : null,
      subjectArchivedAt: null,
    },
  };
}
