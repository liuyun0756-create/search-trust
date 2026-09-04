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
  "/api/generate-report",
  "/api/report-status",
  "/api/report-meta",
  "/api/reports(.*)",
  "/api/v2/cases(.*)",
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
