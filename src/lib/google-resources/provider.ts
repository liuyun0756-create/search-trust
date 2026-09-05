import { ResourceError, type GoogleResource, type ResourcePage, type ResourceQuery } from "./contracts";

type Row = Record<string, unknown>;
const GA = "https://analyticsadmin.googleapis.com/v1beta/";
const GBP_ACCOUNTS = "https://mybusinessaccountmanagement.googleapis.com/v1/";
const GBP_INFO = "https://mybusinessbusinessinformation.googleapis.com/v1/";
const GSC = "https://www.googleapis.com/webmasters/v3/sites";
const MAX_PAGES = 20;

function row(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ResourceError("GOOGLE_UNAVAILABLE", 503);
  return value as Row;
}
function rows(value: unknown): Row[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new ResourceError("GOOGLE_UNAVAILABLE", 503);
  return value.map(row);
}
function text(value: unknown): string | null {
  return typeof value === "string" && value.length <= 2048 ? value : null;
}
function resourceName(value: unknown, type: "accounts" | "properties" | "locations"): string {
  if (typeof value !== "string" || !new RegExp(`^${type}/[0-9]+$`).test(value)) throw new ResourceError("INVALID_REQUEST");
  return value;
}
function website(value: unknown): string | null {
  try {
    const url = new URL(String(value));
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    // Query strings and fragments are not identity clues and can contain secrets.
    return `${url.origin}${url.pathname}`;
  } catch { return null; }
}
function base(id: string, name: string, source: GoogleResource["source"], kind: GoogleResource["kind"], parent: string | null): GoogleResource {
  return { id, name, source, kind, parent, account_name: null, website_urls: [], address: null,
    service_areas: [], permission: null, selectable: kind !== "account" };
}

export interface ResourceProvider {
  list(token: string, query: ResourceQuery): Promise<ResourcePage>;
  verify(token: string, query: ResourceQuery & { resourceId: string }): Promise<GoogleResource>;
}

export class GoogleResourceHttpProvider implements ResourceProvider {
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  private async get(endpoint: string, token: string, parameters: Record<string, string> = {}): Promise<Row> {
    const url = new URL(endpoint);
    for (const [key, value] of Object.entries(parameters)) if (value) url.searchParams.set(key, value);
    try {
      const response = await this.fetcher(url.toString(), {
        headers: { authorization: `Bearer ${token}` }, method: "GET", cache: "no-store",
        redirect: "error", signal: AbortSignal.timeout(12_000),
      });
      if ([401, 403, 404].includes(response.status)) throw new ResourceError("RESOURCE_UNAVAILABLE", 403);
      if (!response.ok) throw new ResourceError("GOOGLE_UNAVAILABLE", 503);
      return row(await response.json());
    } catch (error) {
      if (error instanceof ResourceError) throw error;
      throw new ResourceError("GOOGLE_UNAVAILABLE", 503);
    }
  }

  async list(token: string, query: ResourceQuery): Promise<ResourcePage> {
    const { source, parent = null, pageToken = null } = query;
    if (pageToken && (pageToken.length > 4096 || /[\r\n]/.test(pageToken))) throw new ResourceError("INVALID_REQUEST");
    if (parent) resourceName(parent, "accounts");
    let data: Row;
    let resources: GoogleResource[];
    if (source === "gsc") {
      if (parent || pageToken) throw new ResourceError("INVALID_REQUEST");
      data = await this.get(GSC, token);
      resources = rows(data.siteEntry).filter(r => ["siteOwner", "siteFullUser", "siteRestrictedUser"].includes(String(r.permissionLevel)))
        .flatMap(r => {
          const id = text(r.siteUrl);
          if (!id || !(id.startsWith("sc-domain:") || website(id))) return [];
          return [{ ...base(id, id, source, "site", null), website_urls: [id], permission: text(r.permissionLevel) }];
        });
    } else if (source === "ga4") {
      // Summaries include properties the caller can access even without account-level access.
      if (parent) throw new ResourceError("INVALID_REQUEST");
      data = await this.get(`${GA}accountSummaries`, token, { pageSize: "50", pageToken: pageToken ?? "" });
      resources = rows(data.accountSummaries).flatMap(account => rows(account.propertySummaries).map(property => {
        const id = resourceName(property.property, "properties");
        return { ...base(id, text(property.displayName) || id, source, "property", resourceName(account.account, "accounts")),
          account_name: text(account.displayName) };
      }));
    } else {
      data = parent
        ? await this.get(`${GBP_INFO}${parent}/locations`, token, {
          pageSize: "100", pageToken: pageToken ?? "", readMask: "name,title,websiteUri,storefrontAddress,serviceArea",
        })
        : await this.get(`${GBP_ACCOUNTS}accounts`, token, { pageSize: "20", pageToken: pageToken ?? "" });
      resources = parent ? rows(data.locations).map(location => {
        const id = resourceName(location.name, "locations");
        const address = location.storefrontAddress ? row(location.storefrontAddress) : {};
        const area = location.serviceArea ? row(location.serviceArea) : {};
        const places = area.places ? row(area.places) : {};
        const url = website(location.websiteUri);
        return { ...base(id, text(location.title) || id, source, "location", parent),
          website_urls: url ? [url] : [],
          location_address: { country_code: text(address.regionCode), city: text(address.locality), postal_code: text(address.postalCode) },
          address: [...(Array.isArray(address.addressLines) ? address.addressLines : []), address.locality, address.administrativeArea, address.postalCode, address.regionCode]
            .map(text).filter(Boolean).join(", ") || null,
          service_areas: rows(places.placeInfos).map(place => text(place.placeName)).filter((v): v is string => !!v),
        };
      }) : rows(data.accounts).map(account => {
        const id = resourceName(account.name, "accounts");
        return base(id, text(account.accountName) || id, source, "account", null);
      });
    }
    return { resources, next_page_token: text(data.nextPageToken) || null };
  }

  async verify(token: string, query: ResourceQuery & { resourceId: string }): Promise<GoogleResource> {
    if (query.source === "ga4") {
      const id = resourceName(query.resourceId, "properties");
      const parent = resourceName(query.parent, "accounts");
      const property = await this.get(`${GA}${id}`, token);
      if (property.name !== id || property.account !== parent || property.deleteTime) throw new ResourceError("RESOURCE_UNAVAILABLE", 403);
      const urls: string[] = [];
      let incomplete = false;
      let pageToken = "";
      const seen = new Set<string>();
      for (let page = 0; page < MAX_PAGES; page++) {
        const streams = await this.get(`${GA}${id}/dataStreams`, token, { pageSize: "200", pageToken });
        for (const stream of rows(streams.dataStreams)) {
          if (stream.type === "WEB_DATA_STREAM") {
            const url = stream.webStreamData ? website(row(stream.webStreamData).defaultUri) : null;
            if (url) urls.push(url);
            else incomplete = true;
          }
        }
        pageToken = text(streams.nextPageToken) || "";
        if (!pageToken) return { ...base(id, text(property.displayName) || id, "ga4", "property", parent), website_urls: [...new Set(urls)], website_evidence_incomplete: incomplete || urls.length === 0 };
        if (seen.has(pageToken)) break;
        seen.add(pageToken);
      }
      throw new ResourceError("DISCOVERY_LIMIT", 503);
    }
    if (query.source === "gbp") {
      resourceName(query.resourceId, "locations");
      resourceName(query.parent, "accounts");
    }
    let pageToken: string | null = null;
    const seen = new Set<string>();
    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await this.list(token, { source: query.source, parent: query.parent, pageToken });
      const selected = result.resources.find(resource => resource.id === query.resourceId && resource.selectable);
      if (selected) return selected;
      pageToken = result.next_page_token;
      if (!pageToken) throw new ResourceError("RESOURCE_UNAVAILABLE", 403);
      if (seen.has(pageToken)) break;
      seen.add(pageToken);
    }
    throw new ResourceError("DISCOVERY_LIMIT", 503);
  }
}
