#!/usr/bin/env node
/**
 * Smoke: teacher create exam → upload → analyze → student upload → results + RBAC 403
 */
const fs = require("fs");
const path = require("path");

const BASE = process.env.SMOKE_BASE || "http://127.0.0.1:3000";

class CookieJar {
  constructor() {
    this.map = new Map();
  }
  store(res) {
    const raw = typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [];
    const list = raw.length
      ? raw
      : (res.headers.get("set-cookie") || "")
          .split(/,(?=\s*[^;]+=)/)
          .filter(Boolean);
    for (const c of list) {
      const part = c.split(";")[0];
      const eq = part.indexOf("=");
      if (eq < 0) continue;
      const k = part.slice(0, eq).trim();
      const v = part.slice(eq + 1).trim();
      this.map.set(k, v);
    }
  }
  header() {
    return [...this.map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

async function signIn(email, password) {
  const jar = new CookieJar();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, {
    headers: { cookie: jar.header() },
  });
  jar.store(csrfRes);
  const csrf = (await csrfRes.json()).csrfToken;
  const body = new URLSearchParams({
    csrfToken: csrf,
    email,
    password,
    callbackUrl: `${BASE}/`,
    json: "true",
  });
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      cookie: jar.header(),
    },
    body,
    redirect: "manual",
  });
  jar.store(res);
  if (![200, 302].includes(res.status)) {
    throw new Error(`signIn failed ${email}: ${res.status}`);
  }
  return jar;
}

async function json(jar, url, init = {}) {
  const res = await fetch(`${BASE}${url}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      cookie: jar.header(),
    },
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return { res, data };
}

async function waitJob(jar, jobId, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { res, data } = await json(jar, `/api/jobs/${jobId}`);
    if (!res.ok) throw new Error(`job poll failed: ${JSON.stringify(data)}`);
    const status = data.job.status;
    process.stdout.write(`  job ${jobId} → ${status}\n`);
    if (status === "SUCCEEDED" || status === "FAILED") return data.job;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("job timeout");
}

async function main() {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );

  console.log("1) teacher sign-in + workspace");
  const teacher = await signIn("teacher@example.com", "password");
  let { res, data } = await json(teacher, "/api/workspace");
  if (!res.ok) throw new Error(`workspace ${JSON.stringify(data)}`);
  const classSubjectId = data.classSubjects[0].id;
  console.log("  class", classSubjectId);

  console.log("2) create exam");
  ({ res, data } = await json(teacher, "/api/exams", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      classSubjectId,
      title: "Smoke Midterm",
      examDate: "2026-09-23",
    }),
  }));
  if (!res.ok) throw new Error(`create exam ${JSON.stringify(data)}`);
  const examId = data.exam.id;
  console.log("  exam", examId);

  console.log("3) upload question paper");
  const fd = new FormData();
  fd.set("kind", "QUESTION_PAPER");
  fd.set("file", new Blob([png], { type: "image/png" }), "paper.png");
  ({ res, data } = await json(teacher, `/api/exams/${examId}/assets`, {
    method: "POST",
    body: fd,
  }));
  if (!res.ok) throw new Error(`upload asset ${JSON.stringify(data)}`);
  console.log("  asset", data.asset.id);

  console.log("4) structure analysis job");
  ({ res, data } = await json(teacher, `/api/exams/${examId}/analyze`, {
    method: "POST",
  }));
  if (!res.ok) throw new Error(`analyze ${JSON.stringify(data)}`);
  console.log("  llmModel for new job:", data.llmModel);
  const structureJob = await waitJob(teacher, data.jobId);
  if (structureJob.status !== "SUCCEEDED") {
    throw new Error(`structure failed: ${structureJob.errorMessage}`);
  }

  console.log("5) student upload script");
  const student = await signIn("student@example.com", "password");
  await json(student, "/api/workspace");
  const sfd = new FormData();
  sfd.set("file", new Blob([png], { type: "image/png" }), "script.png");
  ({ res, data } = await json(student, `/api/exams/${examId}/submissions`, {
    method: "POST",
    body: sfd,
  }));
  if (!res.ok) throw new Error(`student upload ${JSON.stringify(data)}`);
  const submissionId = data.submission.id;
  const scoringJob = await waitJob(student, data.job.jobId);
  if (scoringJob.status !== "SUCCEEDED") {
    throw new Error(`scoring failed: ${scoringJob.errorMessage}`);
  }

  console.log("6) student results");
  ({ res, data } = await json(student, `/api/submissions/${submissionId}`));
  if (!res.ok) throw new Error(`results ${JSON.stringify(data)}`);
  if (!data.submission.scoringLlmModel) {
    throw new Error("scoringLlmModel not persisted");
  }
  if (!data.submission.questionScores?.length) {
    throw new Error("expected question scores");
  }
  console.log(
    "  scores",
    data.submission.questionScores.length,
    "model",
    data.submission.scoringLlmModel,
  );

  console.log("7) RBAC: student cannot hit teacher analyze");
  ({ res, data } = await json(student, `/api/exams/${examId}/analyze`, {
    method: "POST",
  }));
  if (res.status !== 403) {
    throw new Error(`expected 403 for student analyze, got ${res.status}`);
  }
  console.log("  student analyze → 403 OK");

  console.log("8) RBAC: student settings API → 403");
  ({ res } = await json(student, "/api/admin/school-settings"));
  if (res.status !== 403) {
    throw new Error(`expected 403 settings, got ${res.status}`);
  }
  console.log("  student settings → 403 OK");

  console.log("9) failed upload (empty file) vendor-neutral");
  const bad = new FormData();
  bad.set("kind", "ANSWER_KEY");
  bad.set("file", new Blob([]), "empty.png");
  ({ res, data } = await json(teacher, `/api/exams/${examId}/assets`, {
    method: "POST",
    body: bad,
  }));
  if (res.ok) throw new Error("empty upload should fail");
  const err = String(data.error || "");
  if (/openrouter|jina|openai|google/i.test(err)) {
    throw new Error(`vendor leak in error: ${err}`);
  }
  console.log("  empty upload error:", err);

  // Unused import silence
  void fs;
  void path;

  console.log("\nSMOKE PASS");
}

main().catch((e) => {
  console.error("\nSMOKE FAIL", e);
  process.exit(1);
});
