import { getDomain } from "tldts";

export function ga4HostsForCase(siteUrl: string, normalizedDomain: string): string[] {
  const canonical = normalizedDomain.trim().toLowerCase();
  let url: URL;
  try { url = new URL(siteUrl); } catch { throw new Error("INVALID_CASE_HOST"); }
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port ||
      hostname !== canonical || canonical.length > 253 || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(canonical)) {
    throw new Error("INVALID_CASE_HOST");
  }
  const registrable = getDomain(canonical, { allowPrivateDomains: true });
  if (!registrable) throw new Error("INVALID_CASE_HOST");
  return registrable === canonical ? [canonical, `www.${canonical}`] : [canonical];
}
