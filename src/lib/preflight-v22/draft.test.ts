import expiredWorkflow from "./fixtures/expired-workflow.json";
import { parseDraft } from "./draft";
import { reduceWorkspaceState, type NewCaseDraft } from "./state-machine";
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


describe("server-owned workflow lifetime", () => {
  const captured = expiredWorkflow as NewCaseDraft;
  const clickedAt = new Date("2026-11-07T12:48:00Z");
  it("preserves the captured TTL boundary through Generate and START_ANALYSIS", () => {
    // Exact captured dates; identifiers/content are synthetic and minimized.
    const storage = memoryStorage();
    expect(parseDraft(captured, clickedAt)).not.toBeNull();
    const handed = reduceWorkspaceState(captured, {type:"BEGIN_AUTH_HANDOFF"}, clickedAt);
    const started = reduceWorkspaceState(handed, {type:"START_ANALYSIS",job_id:id,idempotency_key:`analyze:${id}:${id}`},clickedAt);
    expect(Date.parse(started.updated_at)).toBeGreaterThan(Date.parse(started.expires_at));
    expect(() => saveDraft(storage, started)).not.toThrow();
    expect(loadDraft(storage, clickedAt)).toEqual(started);
  });
  it("recovers an expired paid workflow on refresh without extending its local expiry", () => {
    const storage = memoryStorage();storage.setItem(NEW_CASE_DRAFT_STORAGE_KEY,JSON.stringify(captured));
    expect(loadDraft(storage,clickedAt)).toEqual(captured);
  });
  it("still expires anonymous drafts and rejects malformed workflow IDs", () => {
    expect(parseDraft({...captured,prospect_workflow_id:null},clickedAt)).toBeNull();
    expect(parseDraft({...captured,prospect_workflow_id:"invalid"},clickedAt)).toBeNull();
    const storage=memoryStorage();storage.setItem(NEW_CASE_DRAFT_STORAGE_KEY,JSON.stringify({...captured,prospect_workflow_id:null}));
    expect(loadDraft(storage,clickedAt).stage).toBe("goal_website");
    expect(storage.getItem(NEW_CASE_DRAFT_STORAGE_KEY)).toBeNull();
  });
});
