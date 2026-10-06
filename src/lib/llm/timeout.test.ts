/**
 * Timeout copy must tell teachers the job failed, uploads are kept,
 * and to click the exact re-analyze button label — never “refresh later”.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { ANALYSIS_TIMEOUT_ZH } from "./timeout.ts";
import { getDictionary } from "../i18n/dictionaries.ts";

test("ANALYSIS_TIMEOUT_ZH matches PD copy and references 重新分析", () => {
  assert.equal(
    ANALYSIS_TIMEOUT_ZH,
    "分析需時太長，未能完成。答卷已保存，不需要重新上傳，請按「重新分析」。",
  );
  assert.ok(!ANALYSIS_TIMEOUT_ZH.includes("稍後"));
  assert.ok(!ANALYSIS_TIMEOUT_ZH.toLowerCase().includes("refresh"));
});

test("dictionary analysisTimeout / examReanalyze stay aligned", () => {
  const zh = getDictionary("zh-HK");
  const en = getDictionary("en");
  assert.equal(zh.examReanalyze, "重新分析");
  assert.equal(zh.examAnalyzing, "分析中…");
  assert.equal(zh.analysisTimeout, ANALYSIS_TIMEOUT_ZH);
  assert.equal(en.examReanalyze, "Re-analyze");
  assert.ok(en.analysisTimeout.includes("Re-analyze"));
  assert.ok(en.analysisTimeout.includes("no need to re-upload"));
  assert.ok(!en.analysisTimeout.toLowerCase().includes("refresh later"));
});
