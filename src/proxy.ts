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
  "/api/webhook/(.*)",
  "/api/generate-report",
  "/api/report-status",
  "/api/report-meta",
  "/api/reports(.*)",
  "/api/checkout(.*)",
  "/api/user/credits",
]);

export const proxy = clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|images).*)",
  ],
};
