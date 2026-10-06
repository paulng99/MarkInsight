import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { register } from "node:module";

// Resolve extensionless relative imports under node:test (same pattern as credentials.test.ts).
register(
  `data:text/javascript,${encodeURIComponent(`
    export async function resolve(specifier, context, nextResolve) {
      if (specifier.startsWith(".") && !specifier.match(/\\.[a-zA-Z0-9]+$/)) {
        try {
          return await nextResolve(specifier + ".ts", context);
        } catch {
          return nextResolve(specifier, context);
        }
      }
      return nextResolve(specifier, context);
    }
  `)}`,
  pathToFileURL("./"),
);

const {
  ANALYSIS_STALL_IDLE_MS,
  ANALYSIS_WAITING_HINT_IDLE_MS,
  assertAnalysisJobAvailable,
  assertExamStructureAnalysisAvailable,
  resolveAnalysisReanalyzeGate,
} = await import("./analysis-reanalyze-gate.ts");

const NOW = Date.parse("2026-09-29T12:00:00.000Z");

test("within 30 seconds the button is blocked but the waiting hint stays hidden", () => {
  const recent = new Date(NOW - 30_000).toISOString();
  for (const jobStatus of ["PENDING", "RUNNING", "ANALYZING", "QUEUED"] as const) {
    const gate = resolveAnalysisReanalyzeGate({
      jobStatus,
      touchedAt: recent,
      now: NOW,
    });
    assert.equal(gate.blockedByActiveJob, true);
    assert.equal(gate.showWaitingHint, false);
    assert.equal(gate.stalled, false);
  }
});

test("exactly at one minute the waiting hint stays hidden (strictly greater than)", () => {
  const edge = new Date(NOW - ANALYSIS_WAITING_HINT_IDLE_MS).toISOString();
  const gate = resolveAnalysisReanalyzeGate({
    jobStatus: "RUNNING",
    touchedAt: edge,
    now: NOW,
  });
  assert.equal(gate.blockedByActiveJob, true);
  assert.equal(gate.showWaitingHint, false);
  assert.equal(gate.stalled, false);
});

test("after one minute of idle the waiting hint appears while the button stays blocked", () => {
  const idle = new Date(NOW - ANALYSIS_WAITING_HINT_IDLE_MS - 1).toISOString();
  const gate = resolveAnalysisReanalyzeGate({
    jobStatus: "RUNNING",
    touchedAt: idle,
    now: NOW,
  });
  assert.equal(gate.blockedByActiveJob, true);
  assert.equal(gate.showWaitingHint, true);
  assert.equal(gate.stalled, false);
});

test("exactly at three minutes the button stays blocked and the hint still shows", () => {
  const edge = new Date(NOW - ANALYSIS_STALL_IDLE_MS).toISOString();
  const gate = resolveAnalysisReanalyzeGate({
    jobStatus: "RUNNING",
    touchedAt: edge,
    now: NOW,
  });
  assert.equal(gate.stalled, false);
  assert.equal(gate.blockedByActiveJob, true);
  assert.equal(gate.showWaitingHint, true);
});

test("after about three minutes of idle, re-analyze is allowed and the hint hides", () => {
  const old = new Date(NOW - ANALYSIS_STALL_IDLE_MS - 1).toISOString();
  const gate = resolveAnalysisReanalyzeGate({
    jobStatus: "RUNNING",
    touchedAt: old,
    now: NOW,
  });
  assert.equal(gate.stalled, true);
  assert.equal(gate.blockedByActiveJob, false);
  assert.equal(gate.showWaitingHint, false);
});

test("startingAnalysis blocks the button but never shows the waiting hint", () => {
  const gate = resolveAnalysisReanalyzeGate({
    jobStatus: "PENDING",
    touchedAt: new Date(NOW - ANALYSIS_WAITING_HINT_IDLE_MS - 1).toISOString(),
    now: NOW,
    startingAnalysis: true,
  });
  assert.equal(gate.blockedByActiveJob, true);
  assert.equal(gate.showWaitingHint, false);
  assert.equal(gate.stalled, false);
});

test("RUNNING with neither startedAt nor progress stays blocked without the hint", () => {
  const gate = resolveAnalysisReanalyzeGate({
    jobStatus: "RUNNING",
    touchedAt: null,
    now: NOW,
  });
  assert.equal(gate.jobActive, true);
  assert.equal(gate.stalled, false);
  assert.equal(gate.blockedByActiveJob, true);
  assert.equal(gate.showWaitingHint, false);
});

test("succeeded or failed jobs do not show the waiting hint", () => {
  for (const jobStatus of ["SUCCEEDED", "FAILED", "DONE"] as const) {
    const gate = resolveAnalysisReanalyzeGate({
      jobStatus,
      touchedAt: new Date(NOW - ANALYSIS_WAITING_HINT_IDLE_MS - 1).toISOString(),
      now: NOW,
    });
    assert.equal(gate.showWaitingHint, false);
    assert.equal(gate.blockedByActiveJob, false);
  }
});

test("assertAnalysisJobAvailable blocks a fresh active job", () => {
  assert.throws(
    () =>
      assertAnalysisJobAvailable({
        activeStatus: "RUNNING",
        touchedAt: new Date(NOW - 30_000),
        now: NOW,
      }),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "analysis_in_progress",
  );
});

test("assertAnalysisJobAvailable allows a stalled active job", () => {
  assert.doesNotThrow(() =>
    assertAnalysisJobAvailable({
      activeStatus: "PENDING",
      touchedAt: new Date(NOW - ANALYSIS_STALL_IDLE_MS - 1),
      now: NOW,
    }),
  );
});

test("assertAnalysisJobAvailable allows when no active job", () => {
  assert.doesNotThrow(() =>
    assertAnalysisJobAvailable({
      activeStatus: null,
      touchedAt: null,
      now: NOW,
    }),
  );
});

test("assertExamStructureAnalysisAvailable remains an alias", () => {
  assert.equal(assertExamStructureAnalysisAvailable, assertAnalysisJobAvailable);
});
