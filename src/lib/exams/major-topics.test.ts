import assert from "node:assert/strict";
import test from "node:test";
import { majorTopicLabel } from "./major-topics.ts";

test("majorTopicLabel rolls fine physics topics up to syllabus sections", () => {
  const cases: Array<[string, string, string]> = [
    ["熱和氣體", "Heat and Gases", "熱和氣體"],
    ["熱與氣體", "Heat and Gases", "熱和氣體"],
    ["熱力學", "Thermodynamics", "熱和氣體"],
    ["氣體", "Gases", "熱和氣體"],
    ["力與運動", "Force and Motion", "力和運動"],
    ["波動", "Wave Motion", "波動"],
    ["光學", "Optics", "波動"],
    ["光學", "Light", "波動"],
    ["電力和磁力", "Electricity and Magnetism", "電和磁"],
    ["電磁感應", "Electromagnetic Induction", "電和磁"],
    ["電力學", "Electrodynamics", "電和磁"],
    ["放射性與核能", "Radioactivity and Nuclear Energy", "放射和核能"],
    ["放射性和核能", "Radioactivity and Nuclear Energy", "放射和核能"],
  ];
  for (const [topicZh, topicEn, expected] of cases) {
    assert.equal(majorTopicLabel({ topicZh, topicEn }, "zh-HK"), expected, topicZh);
  }
});

test("majorTopicLabel uses the English section name in English", () => {
  assert.equal(
    majorTopicLabel({ topicZh: "光學", topicEn: "Light" }, "en"),
    "Wave Motion",
  );
  assert.equal(
    majorTopicLabel({ topicZh: "熱力學", topicEn: "Thermodynamics" }, "en"),
    "Heat and Gases",
  );
});

test("majorTopicLabel keeps topics outside the syllabus sections", () => {
  assert.equal(majorTopicLabel({ topicZh: "代數", topicEn: "Algebra" }, "zh-HK"), "代數");
  assert.equal(majorTopicLabel({ topicZh: "代數", topicEn: "Algebra" }, "en"), "Algebra");
});
