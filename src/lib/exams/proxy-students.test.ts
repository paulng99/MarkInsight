import assert from "node:assert/strict";
import test from "node:test";
import {
  pendingEmailFromOptionId,
  pendingStudentOptionId,
  toProxyStudentRows,
} from "./proxy-students.ts";

test("pending option id round-trips an email", () => {
  const id = pendingStudentOptionId("  Student@School.edu.hk ");
  assert.equal(id, "pending:student@school.edu.hk");
  assert.equal(pendingEmailFromOptionId(id), "student@school.edu.hk");
});

test("real user ids are not treated as pending emails", () => {
  assert.equal(pendingEmailFromOptionId("cm123abc"), null);
  assert.equal(pendingEmailFromOptionId("pending:not-an-email"), null);
  assert.equal(pendingEmailFromOptionId(""), null);
});

test("proxy list includes enrolled students and emails waiting to register", () => {
  const rows = toProxyStudentRows(
    [
      {
        enrollmentId: "enr-1",
        studentId: "user-1",
        name: "Chan Tai Man",
        email: "chan@school.edu.hk",
        submission: null,
      },
    ],
    ["wong@school.edu.hk", "chan@school.edu.hk", "  "],
  );

  assert.deepEqual(
    rows.map((row) => ({
      studentId: row.studentId,
      email: row.email,
      pending: row.pending,
    })),
    [
      { studentId: "user-1", email: "chan@school.edu.hk", pending: false },
      {
        studentId: "pending:wong@school.edu.hk",
        email: "wong@school.edu.hk",
        pending: true,
      },
    ],
  );
});
