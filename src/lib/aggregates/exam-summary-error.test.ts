import assert from "node:assert/strict";
import test from "node:test";
import { mapClassExamSummaryError } from "./exam-summary-error.ts";

const t = {
  classExamSummaryForbidden: "forbidden-local",
  classExamSummaryNotFound: "not-found-local",
  classExamSummaryArchived: "archived-local",
  classExamSummaryError: "generic-local",
};

test("maps 403/404/409 to localized copy without retry", () => {
  assert.deepEqual(mapClassExamSummaryError(403, t), {
    message: "forbidden-local",
    retryable: false,
  });
  assert.deepEqual(mapClassExamSummaryError(404, t), {
    message: "not-found-local",
    retryable: false,
  });
  assert.deepEqual(mapClassExamSummaryError(409, t), {
    message: "archived-local",
    retryable: false,
  });
});

test("maps other status and network failure to generic retryable error", () => {
  assert.deepEqual(mapClassExamSummaryError(500, t), {
    message: "generic-local",
    retryable: true,
  });
  assert.deepEqual(mapClassExamSummaryError(null, t), {
    message: "generic-local",
    retryable: true,
  });
});
