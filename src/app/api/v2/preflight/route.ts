import { createPreflightProxy } from "@/lib/preflight-v22/proxy";
import { requireV22PublicEntry } from "@/lib/release-v22/public-entry";

export const dynamic = "force-dynamic";
export const POST = requireV22PublicEntry(createPreflightProxy());
