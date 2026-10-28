import { afterEach, describe, expect, it, vi } from "vitest";
import { isFirstServiceSetupEnabled } from "./config";

afterEach(() => vi.unstubAllEnvs());
describe("first-service preparation release boundary", () => {
  it.each([undefined, "false", "TRUE", "1"])("is default closed for %s", (value) => {
    vi.stubEnv("V22_FIRST_SERVICE_SETUP_ENABLED", value);
    vi.stubEnv("GOOGLE_CONNECTIONS_ENABLED", "true");
    vi.stubEnv("V22_PUBLIC_ENTRY_ENABLED", "true");
    expect(isFirstServiceSetupEnabled()).toBe(false);
  });
  it("requires both shared intake and Google connections, even with the setup flag", () => {
    vi.stubEnv("V22_FIRST_SERVICE_SETUP_ENABLED", "true");
    vi.stubEnv("V22_PUBLIC_ENTRY_ENABLED", "false");
    vi.stubEnv("GOOGLE_CONNECTIONS_ENABLED", "true");
    expect(isFirstServiceSetupEnabled()).toBe(false);
    vi.stubEnv("V22_PUBLIC_ENTRY_ENABLED", "true");
    vi.stubEnv("GOOGLE_CONNECTIONS_ENABLED", "false");
    expect(isFirstServiceSetupEnabled()).toBe(false);
    vi.stubEnv("GOOGLE_CONNECTIONS_ENABLED", "true");
    expect(isFirstServiceSetupEnabled()).toBe(true);
  });
});
