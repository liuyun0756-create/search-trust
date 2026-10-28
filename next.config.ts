import type { NextConfig } from "next";

export const SHARE_SECURITY_HEADERS = [
  { key: "Cache-Control", value: "private, no-store, max-age=0" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
];

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/share/pdf": [
      "./public/fonts/capability/*.ttf",
      "./public/fonts/capability/OFL.txt",
    ],
    "/api/v2/cases/*/reports/*/client-pdf": [
      "./public/fonts/capability/*.ttf",
      "./public/fonts/capability/OFL.txt",
    ],
    "/api/v2/cases/*/reports/*/review/client-pdf": [
      "./public/fonts/capability/*.ttf",
      "./public/fonts/capability/OFL.txt",
    ],
  },
  async headers() {
    return [
      {
        source: "/cases/:caseId/reports/:reportId/review-evidence",
        headers: SHARE_SECURITY_HEADERS,
      },
      {
        source: "/cases/:caseId/reports/:reportId/review-decisions",
        headers: SHARE_SECURITY_HEADERS,
      },
      {
        source: "/cases/:caseId/reports/:reportId/review",
        headers: SHARE_SECURITY_HEADERS,
      },
      { source: "/share", headers: SHARE_SECURITY_HEADERS },
      { source: "/share/:path*", headers: SHARE_SECURITY_HEADERS },
      { source: "/api/share/:path*", headers: SHARE_SECURITY_HEADERS },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  turbopack: {},
  webpack(config) {
    const ignored = config.watchOptions?.ignored;
    config.watchOptions = {
      ...config.watchOptions,
      // Keep Next's own exclusions: replacing them can watch generated chunks
      // and cause a hot-update loop that resets interactive page state.
      ignored:
        ignored instanceof RegExp
          ? new RegExp(
              `(?:${ignored.source})|(?:^|[\\\\/])output[\\\\/]`,
              ignored.flags,
            )
          : [
              ...(Array.isArray(ignored) ? ignored : ignored ? [ignored] : []),
              "**/output/**",
            ],
    };
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: [{ loader: "@svgr/webpack", options: { icon: true } }],
    });
    return config;
  },
};

export default nextConfig;
