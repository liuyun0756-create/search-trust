import { describe, expect, it } from "vitest";
import {
  legacyScenarioHashes,
  practiceGroups,
  practiceScenarios,
  practiceStages,
} from "./practice-scenarios";

describe("Client Scenarios content", () => {
  it("has two stages, five groups and three complete stories per group", () => {
    expect(practiceStages).toHaveLength(2);
    expect(practiceGroups).toHaveLength(5);
    expect(practiceScenarios).toHaveLength(15);
    expect(new Set(practiceScenarios.map((scenario) => scenario.id)).size).toBe(
      15,
    );
    for (const stage of practiceStages) {
      expect(stage.groupIds.length).toBe(stage.id === "prospect" ? 2 : 3);
      for (const groupId of stage.groupIds) {
        const group = practiceGroups.find((item) => item.id === groupId);
        expect(group?.stageId).toBe(stage.id);
        expect(group?.scenarioIds).toHaveLength(3);
      }
    }
    for (const group of practiceGroups) {
      for (const id of group.scenarioIds) {
        const story = practiceScenarios.find((item) => item.id === id);
        expect(story?.groupId).toBe(group.id);
      }
    }
  });

  it("provides a real destination, concrete excerpt and limit for every story", () => {
    const kinds = new Set<string>();
    for (const story of practiceScenarios) {
      for (const text of [
        story.title,
        story.story,
        story.tension,
        story.assistance,
        story.nextMove,
        story.boundary,
      ]) {
        expect(text.trim().length).toBeGreaterThan(25);
      }
      expect(story.artifact.items.length).toBeGreaterThanOrEqual(3);
      expect(story.artifact.items.length).toBeLessThanOrEqual(4);
      expect(story.primaryCta.href).toMatch(
        /^\/(cases\/new|cases\/service|reports)$/,
      );
      expect(story.sampleLink.href).toMatch(/^\/sample-report#sample-/);
      if (story.methodLink) expect(story.methodLink).toMatch(/^0[1-6]$/);
      kinds.add(story.artifact.kind);
    }
    expect(kinds).toEqual(
      new Set(["brief", "comparison", "plan", "revision", "review"]),
    );
    expect(Object.keys(legacyScenarioHashes)).toHaveLength(6);
    for (const id of Object.values(legacyScenarioHashes)) {
      expect(practiceScenarios.some((story) => story.id === id)).toBe(true);
    }
  });
});
