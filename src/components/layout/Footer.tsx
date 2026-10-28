import Link from "next/link";
import { marketingProductLinks } from "./marketing-navigation";

const footerLinks = {
  Product: marketingProductLinks,
  "Get Started": [
    { href: "#", label: "Sign In" },
    { href: "/cases/new", label: "Start free preflight" },
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
    <footer className="border-t border-[#e0e9e0] bg-[#f7faf7] text-[#1d3127]">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#477c60]">
                {category}
              </h3>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-[#65746a] transition-colors hover:text-[#234b38]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-[#e0e9e0] pt-8 md:flex-row">
          <div className="flex items-center gap-1 text-lg font-bold">
            <span className="text-[#1d3127]">Search</span>
            <span className="text-[#477c60]">Trust</span>
          </div>
          <p className="text-sm text-[#748178]">
            &copy; 2026 SearchTrust. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
