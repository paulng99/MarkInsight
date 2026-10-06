/**
 * Map class-exam-summary API failures to localized copy (never raw backend text).
 */

export type ClassExamSummaryErrorCopy = {
  classExamSummaryForbidden: string;
  classExamSummaryNotFound: string;
  classExamSummaryArchived: string;
  classExamSummaryError: string;
};

export type ClassExamSummaryUiError = {
  message: string;
  retryable: boolean;
};

/**
 * @param status HTTP status, or `null` for network / parse failures
 */
export function mapClassExamSummaryError(
  status: number | null,
  t: ClassExamSummaryErrorCopy,
): ClassExamSummaryUiError {
  switch (status) {
    case 403:
      return { message: t.classExamSummaryForbidden, retryable: false };
    case 404:
      return { message: t.classExamSummaryNotFound, retryable: false };
    case 409:
      return { message: t.classExamSummaryArchived, retryable: false };
    default:
      return { message: t.classExamSummaryError, retryable: true };
  }
}
