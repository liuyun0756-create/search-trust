import {getCurrentUser} from "@/lib/auth";
import {isPageChecksEnabled} from "@/lib/page-checks/config";
import {createPageCheckHandlers} from "@/lib/page-checks/handler";

export const dynamic = "force-dynamic";
export const {GET, POST} = createPageCheckHandlers({enabled: isPageChecksEnabled, user: getCurrentUser,
  config: () => process.env.V22_API_BASE_URL && process.env.V22_INTERNAL_API_TOKEN
    ? {baseUrl: process.env.V22_API_BASE_URL, token: process.env.V22_INTERNAL_API_TOKEN} : null});
