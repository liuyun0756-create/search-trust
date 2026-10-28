import {afterEach, expect, it, vi} from "vitest";
import {isImplementationRecordsEnabled} from "./config";
afterEach(() => vi.unstubAllEnvs());
it("keeps implementation records closed unless both explicit switches are on", () => {
  vi.stubEnv("V22_IMPLEMENTATION_RECORDS_ENABLED", ""); vi.stubEnv("V22_CAPABILITY_DISPATCH_ENABLED", "true");
  expect(isImplementationRecordsEnabled()).toBe(false);
  vi.stubEnv("V22_IMPLEMENTATION_RECORDS_ENABLED", "true"); vi.stubEnv("V22_CAPABILITY_DISPATCH_ENABLED", "false");
  expect(isImplementationRecordsEnabled()).toBe(false);
  vi.stubEnv("V22_CAPABILITY_DISPATCH_ENABLED", "true"); expect(isImplementationRecordsEnabled()).toBe(true);
});
