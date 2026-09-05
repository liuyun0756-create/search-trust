import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/framework",
  "/sample-report",
  "/sample-case",
  "/use-cases",
  "/pricing",
  "/policy",
  "/terms",
  "/privacy",
  "/refund-policy",
  "/reports",
  "/cases/new",
  "/share/(.*)",
  "/api/share/(.*)",
  "/api/webhook/(.*)",
  // Server-to-server worker callbacks use timestamped HMAC authentication.
  "/api/internal/v2/job-events",
  // The token broker authenticates Railway requests with HMAC, not a browser session.
  "/api/internal/v2/google/connections/(.*)/access-token",
  "/api/generate-report",
  "/api/report-status",
  "/api/report-meta",
  "/api/reports(.*)",
  // Case, checkout, report-share, and analysis routes are intentionally not
  // public: Clerk must validate and attach the current user session before
  // their handlers call auth().
  "/api/v2/preflight",
  "/api/v2/competitors(.*)",
  "/api/checkout(.*)",
  "/api/user/credits",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|images).*)",
  ],
};
