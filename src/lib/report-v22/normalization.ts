import data from "./generated/normalization-data.json";
import type { SearchTrustReportV2_2 } from "./generated/types";

const folds: Readonly<Record<string, string>> = data.casefold;
const stringWhitespace = new Set(data.string_whitespace);
const pythonWhitespace = new Set(data.python_whitespace);

/** Python's full, locale-independent case folding, pinned by the generated table. */
export function casefold(value: string): string {
  return Array.from(value, (char) => folds[char] ?? char).join("");
}

/** Match Pydantic string stripping, not JavaScript trim (which also removes BOM). */
export function stripString(value: string): string {
  const characters = Array.from(value);
  let start = 0;
  let end = characters.length;
  while (start < end && stringWhitespace.has(characters[start])) start++;
  while (end > start && stringWhitespace.has(characters[end - 1])) end--;
  return characters.slice(start, end).join("");
}

export function isBlankQuery(value: string): boolean {
  // CaseContext additionally applies Python str.strip() in its nonblank guard.
  return Array.from(value).every((char) => pythonWhitespace.has(char));
}

type TargetMarket = SearchTrustReportV2_2["case_context"]["target_market"];
const marketFields = [
  "display_name", "country_code", "region", "city", "postal_code", "latitude", "longitude",
] as const;

export function sameTargetMarket(left: TargetMarket, right: TargetMarket): boolean {
  return marketFields.every((field) => {
    const leftValue = left[field];
    const rightValue = right[field];
    return (typeof leftValue === "string" ? stripString(leftValue) : leftValue ?? null)
      === (typeof rightValue === "string" ? stripString(rightValue) : rightValue ?? null);
  });
}

/** Compare whole HTTP URLs, including paths/queries, as the existing model does. */
export function competitorWebsiteKey(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return casefold(url.href);
  } catch {
    return null;
  }
}
