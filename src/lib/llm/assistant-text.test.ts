import assert from "node:assert/strict";
import test from "node:test";
import { readAssistantFragment, readAssistantText } from "./assistant-text.ts";

test("reads a plain string answer", () => {
  assert.equal(readAssistantText({ content: '{"questions":[]}' }), '{"questions":[]}');
});

test("reads text parts when content is an array", () => {
  assert.equal(
    readAssistantText({
      content: [
        { type: "text", text: '{"ok":' },
        { type: "text", text: "true}" },
      ],
    }),
    '{"ok":true}',
  );
});

test("uses reasoning JSON when content is empty", () => {
  assert.equal(
    readAssistantText({
      content: "",
      reasoning: 'Looking at the page. {"allocation":[]}',
    }),
    'Looking at the page. {"allocation":[]}',
  );
});

test("ignores reasoning that is not an answer", () => {
  assert.equal(
    readAssistantText({ content: null, reasoning: "The scan is hard to read." }),
    "",
  );
});

test("reads a streamed content fragment", () => {
  assert.equal(readAssistantFragment([{ type: "text", text: "1" }]), "1");
});
