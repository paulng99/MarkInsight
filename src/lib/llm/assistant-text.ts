/**
 * OpenRouter sometimes returns the answer outside `message.content`:
 * an array of text parts, or only in the reasoning fields. A blank
 * string there is not the same as "the file produced no result".
 */

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textOf).join("");
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  if (typeof record.text === "string") return record.text;
  if (typeof record.content === "string") return record.content;
  if (typeof record.reasoning === "string") return record.reasoning;
  return "";
}

export function readAssistantFragment(value: unknown): string {
  return textOf(value);
}

export function readAssistantText(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const record = message as Record<string, unknown>;
  const content = textOf(record.content);
  if (content.trim()) return content;
  const reasoning =
    textOf(record.reasoning) ||
    textOf(record.reasoning_content) ||
    textOf(record.reasoning_details);
  if (reasoning.includes("{") && reasoning.includes("}")) return reasoning;
  return "";
}
