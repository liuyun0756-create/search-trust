import Link from "next/link";

const footerLinks = {
  Product: [
    { href: "/framework", label: "Framework" },
    { href: "/sample-report", label: "Sample Report" },
    { href: "/use-cases", label: "Use Cases" },
    { href: "/pricing", label: "Pricing" },
  ],
  "Get Started": [
    { href: "#", label: "Sign In" },
    { href: "#", label: "Run a Trust Audit" },
  ],
  Legal: [
    { href: "/privacy", label: "Privacy" },
    { href: "/refunds", label: "Refunds" },
    { href: "/terms", label: "Terms" },
  ],
  Learn: [
    { href: "/blog", label: "Blog" },
  ],
};

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-bg-dark text-text-white">
      {/* 1Grid pattern overlay */}
      <div className="bg-grid-dark absolute inset-0" />

      {/* Radial glow */}
      <div className="absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-primary/70">
                {category}
              </h3>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-400 transition-colors hover:text-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-border-dark pt-8 md:flex-row">
          <div className="flex items-center gap-1 text-lg font-bold">
            <span className="text-text-white">Search</span>
            <span className="text-primary">Trust</span>
          </div>
          <p className="text-sm text-gray-500">
            &copy; 2026 SearchTrust. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
