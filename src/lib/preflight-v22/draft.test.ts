import { describe, expect, it } from "vitest";

import { loadDraft, NEW_CASE_DRAFT_STORAGE_KEY, saveDraft, type DraftStorage } from "./draft";
import { createNewCaseDraft, DRAFT_TTL_MS } from "./state-machine";

const id = "11111111-1111-4111-8111-111111111111";

function memoryStorage(): DraftStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

describe("anonymous new Case draft", () => {
  it("saves and restores a valid 24-hour session draft", () => {
    const now = new Date("2026-09-03T08:00:00Z");
    const draft = createNewCaseDraft(now, id, { goal: "work_existing_client", site_url: "example.com" });
    expect(Date.parse(draft.expires_at) - Date.parse(draft.created_at)).toBe(DRAFT_TTL_MS);
    const storage = memoryStorage();
    saveDraft(storage, draft);
    expect(loadDraft(storage, new Date("2026-09-03T09:00:00Z"))).toEqual(draft);
  });

  it("discards expired state but safely recovers goal and URL with a new UUID", () => {
    const storage = memoryStorage();
    const draft = createNewCaseDraft(new Date("2026-09-03T08:00:00Z"), id, { goal: "work_existing_client", site_url: "example.com", gbp_url: "https://maps.google.com/x" });
    storage.setItem(NEW_CASE_DRAFT_STORAGE_KEY, JSON.stringify({ ...draft, stage: "coverage", selected_competitor_ids: ["cp_alpha"] }));
    const recovered = loadDraft(storage, new Date("2026-09-04T08:00:01Z"));
    expect(recovered.stage).toBe("goal_website");
    expect(recovered.goal).toBe("work_existing_client");
    expect(recovered.site_url).toBe("example.com");
    expect(recovered.gbp_url).toBe("https://maps.google.com/x");
    expect(recovered.draft_case_id).not.toBe(id);
    expect(storage.values.has(NEW_CASE_DRAFT_STORAGE_KEY)).toBe(false);
  });

  it("rejects unknown fields and keeps only safe source inputs", () => {
    const storage = memoryStorage();
    storage.setItem(NEW_CASE_DRAFT_STORAGE_KEY, JSON.stringify({
      ...createNewCaseDraft(new Date("2026-09-03T08:00:00Z"), id, { site_url: "example.com" }),
      internal_api_token: "must-not-survive",
    }));
    const recovered = loadDraft(storage, new Date("2026-09-03T09:00:00Z"));
    expect(recovered.site_url).toBe("example.com");
    expect(recovered).not.toHaveProperty("internal_api_token");
    expect(recovered.draft_case_id).not.toBe(id);
  });

  it("recovers from malformed JSON without throwing", () => {
    const storage = memoryStorage();
    storage.setItem(NEW_CASE_DRAFT_STORAGE_KEY, "{");
    const recovered = loadDraft(storage);
    expect(recovered.stage).toBe("goal_website");
    expect(storage.values.has(NEW_CASE_DRAFT_STORAGE_KEY)).toBe(false);
  });
});
