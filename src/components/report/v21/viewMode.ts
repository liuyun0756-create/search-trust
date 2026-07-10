export type V21ViewMode = "client" | "analyst";

const INTERNAL_LIMITATION_MARKERS = [
  "validation note:",
  "pydantic",
  "duplicate",
  "dedupe",
  "deterministic scoring",
  "scoring skipped",
  "legacy-adapted placeholders",
  "structural validation",
  "triggered_rule_ids",
  "checked_rule_ids",
];

const CLIENT_SAFE_LIMITATION_MARKERS = [
  "gbp",
  "schema",
  "review",
  "contact",
  "about",
  "internal page",
  "competitor",
  "not checked",
  "not found",
  "error",
  "unavailable",
  "could not be verified",
];

export function isClientView(mode: V21ViewMode | undefined): boolean {
  return mode === "client";
}

export function isAnalystView(mode: V21ViewMode | undefined): boolean {
  return mode !== "client";
}

export function shouldShowTechnicalDetails(mode: V21ViewMode | undefined): boolean {
  return isAnalystView(mode);
}

export function filterClientLimitations(limitations: string[] | undefined | null): string[] {
  if (!Array.isArray(limitations)) return [];

  return limitations.filter((limitation) => {
    const normalized = limitation.toLowerCase();
    if (INTERNAL_LIMITATION_MARKERS.some((marker) => normalized.includes(marker))) return false;
    return CLIENT_SAFE_LIMITATION_MARKERS.some((marker) => normalized.includes(marker));
  });
}

export function isInternalImplementationNote(note: string): boolean {
  const normalized = note.toLowerCase();
  return INTERNAL_LIMITATION_MARKERS.some((marker) => normalized.includes(marker))
    || normalized.includes("adapter")
    || normalized.includes("placeholder")
    || normalized.includes("model output");
}
