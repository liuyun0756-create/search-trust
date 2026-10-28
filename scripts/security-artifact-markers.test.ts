import { afterEach, expect, it, vi } from "vitest";
import { configuredArtifactMarkers } from "./security-artifact-markers";
afterEach(() => vi.unstubAllEnvs());
it.each([
  "V22_INTERNAL_API_TOKEN",
  "V22_CALLBACK_SECRET",
  "V22_GOOGLE_BROKER_SECRET",
  "V22_SUPABASE_SERVICE_ROLE_KEY",
])("includes new server secret %s in artifact detection", (name) => {
  const sentinel = `isolated-artifact-test-${name}`;
  vi.stubEnv(name, sentinel);
  expect(configuredArtifactMarkers()).toContain(sentinel);
});
it("checks individual vault keys as well as the serialized key ring", () => {
  const key = "isolated-vault-key-for-artifact-test";
  vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEYS", JSON.stringify({ v1: key }));
  const result = configuredArtifactMarkers();
  expect(result).toContain(key);
  expect(result).toContain(JSON.stringify({ v1: key }));
});
