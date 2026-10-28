import { describe, expect, it } from "vitest";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import schema from "./contracts/generation.schema.json";
import fixture from "./contracts/fixture.json";
import { canonicalDigest } from "../verified-analysis-v22/digest";

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const validator = (name: string) =>
  ajv.compile({ $defs: schema.$defs, $ref: `#/$defs/${name}` });
const inputValid = validator("ReviewGenerationInput");
const contentValid = validator("ReviewGenerationContent");
const recipeValid = validator("ReviewGenerationRecipe");

describe("internal review generation contract export (not a public validator)", () => {
  it("accepts backend input and content with identical cross-language hashes", () => {
    expect(fixture.kind).toBe("synthetic_review_generation");
    expect(inputValid(fixture.input), JSON.stringify(inputValid.errors)).toBe(true);
    expect(contentValid(fixture.content), JSON.stringify(contentValid.errors)).toBe(true);
    for (const value of [fixture.input, fixture.content]) {
      const { checksum, ...body } = value;
      expect(canonicalDigest(body)).toBe(checksum);
    }
  });
  it("pins the exact evidence and decision through a reference-only recipe", () => {
    const { input, recipe, content } = fixture;
    expect(recipeValid(recipe), JSON.stringify(recipeValid.errors)).toBe(true);
    expect(recipe.input_checksum).toBe(input.checksum);
    expect(recipe.review_checksum).toBe(input.evidence.bundle.checksum);
    expect(recipe.decision_checksum).toBe(input.decision.checksum);
    expect(content.input_checksum).toBe(input.checksum);
    expect(content.decision_id).toBe(input.decision.id);
    expect(input.evidence.bundle.decisions).toEqual([]);
    expect(recipe).not.toHaveProperty("evidence");
    expect(recipe).not.toHaveProperty("decision");
  });
  it("keeps internal content outside the completed report and client approval contracts", () => {
    expect(fixture.content.schema_version).toBe("v22_review_generation_content_v1");
    expect(fixture.content.delivery_state).toBe("requires_delivery_review");
    expect(fixture.content.report_type).toBe("verified_execution");
    expect(fixture.content.effect).toBeNull();
    expect(fixture.content.causal_attribution).toBe(false);
    const client = JSON.stringify(fixture.content.client_actions);
    for (const field of ["selected_decision", "source_references", "implementation_entry", "completion_statement"]) {
      expect(client).not.toContain(`"${field}"`);
    }
  });
  it.each(["causal_attribution", "effect", "delivery_state"])("rejects unsupported %s", (field) => {
    const content = { ...fixture.content, [field]: field === "causal_attribution" ? true : "completed" };
    expect(contentValid(content)).toBe(false);
  });
});
