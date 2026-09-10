export const E2E_IDENTITY = Object.freeze({
  internalUserId: "e2000000-0000-4000-8000-000000000001",
  clerkUserId: "searchtrust_e2e_user",
  emailAddress: "browser-tests@searchtrust.example.invalid",
  fullName: "SearchTrust Browser Test",
  bearerToken: "searchtrust-e2e-local-token",
});

type E2EEnvironment = Partial<
  Record<
    | "NEXT_PUBLIC_E2E_TEST_MODE"
    | "NEXT_PUBLIC_E2E_BASE_URL"
    | "VERCEL_ENV",
    string | undefined
  >
>;

function isLoopback(url: URL): boolean {
  return url.protocol === "http:" && ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
}

export function resolveLocalE2ETestMode(env: E2EEnvironment): boolean {
  if (env.NEXT_PUBLIC_E2E_TEST_MODE !== "true") return false;
  if (env.VERCEL_ENV) throw new Error("E2E test mode is forbidden in Vercel environments.");

  let baseURL: URL;
  try {
    baseURL = new URL(env.NEXT_PUBLIC_E2E_BASE_URL ?? "");
  } catch {
    throw new Error("E2E test mode requires an explicit loopback base URL.");
  }
  if (!isLoopback(baseURL)) {
    throw new Error("E2E test mode is restricted to a loopback origin.");
  }
  return true;
}

export function isLocalE2ETestMode(): boolean {
  return resolveLocalE2ETestMode({
    NEXT_PUBLIC_E2E_TEST_MODE: process.env.NEXT_PUBLIC_E2E_TEST_MODE,
    NEXT_PUBLIC_E2E_BASE_URL: process.env.NEXT_PUBLIC_E2E_BASE_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
  });
}
