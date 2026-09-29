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
  resolveAnalysisReanalyzeGate,
} = await import("./analysis-reanalyze-gate.ts");

const NOW = Date.parse("2026-09-29T12:00:00.000Z");

test("shows waiting hint while PENDING/RUNNING within the stall idle window", () => {
  const recent = new Date(NOW - 30_000).toISOString();
  for (const jobStatus of ["PENDING", "RUNNING", "ANALYZING", "QUEUED"] as const) {
    const gate = resolveAnalysisReanalyzeGate({
      jobStatus,
      touchedAt: recent,
      now: NOW,
    });
    assert.equal(gate.blockedByActiveJob, true);
    assert.equal(gate.showWaitingHint, true);
    assert.equal(gate.stalled, false);
  }
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

test("exactly at the stall threshold the button stays blocked", () => {
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

test("succeeded or failed jobs do not show the waiting hint", () => {
  for (const jobStatus of ["SUCCEEDED", "FAILED", "DONE"] as const) {
    const gate = resolveAnalysisReanalyzeGate({
      jobStatus,
      touchedAt: new Date(NOW - 60_000).toISOString(),
      now: NOW,
    });
    assert.equal(gate.showWaitingHint, false);
    assert.equal(gate.blockedByActiveJob, false);
  }
});

test("client startingAnalysis blocks and shows the hint even without touchedAt", () => {
  const gate = resolveAnalysisReanalyzeGate({
    jobStatus: "PENDING",
    touchedAt: null,
    now: NOW,
    startingAnalysis: true,
  });
  assert.equal(gate.blockedByActiveJob, true);
  assert.equal(gate.showWaitingHint, true);
  assert.equal(gate.stalled, false);
});

test("RUNNING with neither startedAt nor progress stays blocked (known limitation)", () => {
  const gate = resolveAnalysisReanalyzeGate({
    jobStatus: "RUNNING",
    touchedAt: null,
    now: NOW,
  });
  assert.equal(gate.jobActive, true);
  assert.equal(gate.stalled, false);
  assert.equal(gate.blockedByActiveJob, true);
  assert.equal(gate.showWaitingHint, true);
});
