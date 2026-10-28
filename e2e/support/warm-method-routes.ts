import { request, type FullConfig } from "@playwright/test";

/** Next dev can reload open pages when a sibling worker first compiles a route.
 * Compile the public journeys' destinations before any interactive test starts,
 * so a cold marketing route cannot reset another worker's tabs or deep links.
 * No clicks, retries, altered motion preferences or weakened assertions.
 */
export default async function warmMethodRoutes(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL;
  if (
    !baseURL ||
    !["127.0.0.1", "localhost"].includes(new URL(baseURL).hostname)
  )
    throw new Error("Browser checks require the configured local test server.");
  const api = await request.newContext({ baseURL });
  try {
    for (const path of ["/", "/framework", "/sample-report", "/use-cases", "/pricing", "/cases/new", "/cases/service"]) {
      const response = await api.get(path);
      if (!response.ok())
        throw new Error(
          `Cannot prepare local Method route ${path}: ${response.status()}`,
        );
    }
  } finally {
    await api.dispose();
  }
}
