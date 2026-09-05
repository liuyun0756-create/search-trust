import type { GoogleSource } from "../google-connections/scopes";

export interface GoogleResource {
  id: string;
  name: string;
  source: GoogleSource;
  kind: "account" | "site" | "property" | "location";
  parent: string | null;
  account_name: string | null;
  website_urls: string[];
  address: string | null;
  service_areas: string[];
  permission: string | null;
  selectable: boolean;
}

export interface ResourcePage {
  resources: GoogleResource[];
  next_page_token: string | null;
}

export interface ResourceQuery {
  source: GoogleSource;
  parent?: string | null;
  pageToken?: string | null;
}

export interface ResourceSelection {
  connection_id: string;
  source: GoogleSource;
  resource_id: string;
  parent: string | null;
  expected_binding_id: string | null;
}

export type ResourceErrorCode = "INVALID_REQUEST" | "FORBIDDEN" | "RESOURCE_UNAVAILABLE" |
  "GOOGLE_UNAVAILABLE" | "DISCOVERY_LIMIT" | "BINDING_CHANGED" | "PERSISTENCE_FAILED";

const messages: Record<ResourceErrorCode, string> = {
  INVALID_REQUEST: "Please select a valid Google resource.",
  FORBIDDEN: "This Case or Google account is not available to you.",
  RESOURCE_UNAVAILABLE: "This resource is no longer accessible. Refresh the list or choose another Google account.",
  GOOGLE_UNAVAILABLE: "Google resources could not be loaded. Please try again.",
  DISCOVERY_LIMIT: "This account has too many resources to verify in one request. Please try a more specific account.",
  BINDING_CHANGED: "The Case connection changed. Refresh before making another selection.",
  PERSISTENCE_FAILED: "The resource selection could not be saved. Please try again.",
};

export class ResourceError extends Error {
  constructor(readonly code: ResourceErrorCode, readonly status = 400) {
    super(messages[code]);
    this.name = "ResourceError";
  }
}

export function parseSource(value: unknown): GoogleSource {
  if (value !== "gsc" && value !== "ga4" && value !== "gbp") throw new ResourceError("INVALID_REQUEST");
  return value;
}

export function parseUuid(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new ResourceError("INVALID_REQUEST");
  }
  return value;
}
