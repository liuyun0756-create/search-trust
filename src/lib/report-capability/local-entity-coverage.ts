import type { AnalysisInputManifest, LocalEntityCoverage } from "./generated/types";

const ARCHIVE_PATH = /\/(?:tag|tags|category|categories)(?:\/|$)/i;
const STATUS = {
  present: "Present",
  weak_position: "Weak placement",
  not_detected: "Not detected in the checked sample",
  not_checked: "Not checked",
} as const;
const LIMIT = "Only the confirmed target city is checked. Other places are not assessed.";
const POSITIONS = { title: "Title", h1: "Main heading", body: "Body", footer: "Footer" };

function isArchive(url: string) {
  return ARCHIVE_PATH.test(new URL(url).pathname);
}

export function localEntityCoverageValid(value: LocalEntityCoverage, manifest: AnalysisInputManifest) {
  if (value.target_city !== (manifest.target_market?.city ?? null)) return false;
  const source = manifest.snapshots.find(row => row.source_kind === "site");
  const headings = value.evidence.filter(row => row.location === "title" || row.location === "h1");
  const keys = value.evidence.map(row => JSON.stringify([row.url, row.location, row.path]));
  const status = headings.length ? "present" : keys.length ? "weak_position" : value.complete ? "not_detected" : "not_checked";
  const reason = keys.length ? "saved_positive" : value.complete ? "not_observed_in_saved_sample"
    : value.target_city ? "incomplete_sample" : "target_city_unavailable";
  return value.status === status && value.reason === reason
    && (!!value.target_city || (!keys.length && !value.complete))
    && value.archive_headings_only === (headings.length > 0 && headings.every(row => isArchive(row.url)))
    && keys.length === new Set(keys).size
    && value.evidence.filter(row => row.location === "footer").length <= 1
    && value.evidence.every(row => {
      const url = new URL(row.url);
      const field = row.location === "title" || row.location === "h1" ? row.location : "text";
      return source?.snapshot_id === row.snapshot_id
        && /^\/payload\/selected_pages\/\d+\/deep_snapshot\/(?:title|h1|text)$/.test(row.path)
        && row.path.endsWith("/" + field)
        && ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
    });
}

export function localEntityCoverageView(value: LocalEntityCoverage, clientOnly: boolean) {
  const locations = new Map<string, string>();
  for (const row of value.evidence) {
    if (!locations.has(row.location)) locations.set(row.location, row.quote);
  }
  return {
    city: value.target_city,
    status: STATUS[value.status],
    limit: LIMIT,
    scope: value.status === "not_checked" && value.reason === "target_city_unavailable"
      ? "No confirmed target city was saved."
      : value.complete ? "Checked pages only" : "Some sampled pages could not be checked",
    observations: (Object.keys(POSITIONS) as (keyof typeof POSITIONS)[]).flatMap(key =>
      locations.has(key) ? [{position: POSITIONS[key], quote: locations.get(key)!}] : []),
    ...(!clientOnly ? { technical: {
      reason: value.reason,
      archiveHeadingsOnly: value.archive_headings_only,
      pages: value.evidence.map(row => ({
        url: row.url, position: POSITIONS[row.location], quote: row.quote,
        sampledAt: row.sampled_at, archive: isArchive(row.url),
      })),
    }} : {}),
  };
}
export type LocalEntityCoverageView = ReturnType<typeof localEntityCoverageView>;
