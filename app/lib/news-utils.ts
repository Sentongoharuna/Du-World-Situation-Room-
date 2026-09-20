import type { EventTheme, Severity } from "@/app/lib/types";

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "in",
  "to",
  "for",
  "on",
  "at",
  "with",
  "from",
  "as",
  "after",
  "over",
  "new",
  "latest",
  "live",
]);

export function classifyTheme(title: string, fallback: EventTheme): EventTheme {
  const value = title.toLowerCase();
  if (/earthquake|wildfire|storm|cyclone|hurricane|flood|volcano|tsunami/.test(value)) {
    return "disaster";
  }
  if (/protest|demonstrat|march|strike|rally|unrest/.test(value)) return "protest";
  if (/war|conflict|attack|missile|drone|troops|military|ceasefire|explosion/.test(value)) {
    return "conflict";
  }
  if (/election|president|minister|parliament|government|senate|policy/.test(value)) {
    return "politics";
  }
  return fallback;
}

export function classifySeverity(title: string): Severity {
  const value = title.toLowerCase();
  if (/nuclear|tsunami warning|magnitude [789]|mass casualty|state of emergency/.test(value)) {
    return "critical";
  }
  if (/killed|dead|evacuat|major earthquake|wildfire|missile|explosion|hurricane|cyclone/.test(value)) {
    return "high";
  }
  if (/injur|protest|flood|storm|conflict|attack|warning/.test(value)) return "medium";
  return "low";
}

export function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word)),
  );
}

export function relatedTitles(a: Set<string>, b: Set<string>): boolean {
  if (!a.size || !b.size) return false;
  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap += 1;
  return overlap / Math.min(a.size, b.size) >= 0.58;
}

export function stableId(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function parseGdeltDate(value: string): string {
  const match = value?.match(
    /^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})Z?$/,
  );
  if (!match) return new Date(value || Date.now()).toISOString();
  const [, year, month, day, hour, minute, second] = match;
  return new Date(
    `${year}-${month}-${day}T${hour}:${minute}:${second}Z`,
  ).toISOString();
}
