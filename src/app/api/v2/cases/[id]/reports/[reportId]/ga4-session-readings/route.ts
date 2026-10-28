import {getCurrentUser} from "@/lib/auth";
import {isGa4SessionReadingEnabled} from "@/lib/ga4-session-readings/config";
import {createGa4SessionHandler} from "@/lib/ga4-session-readings/handler";
export const dynamic = "force-dynamic";
export const GET = createGa4SessionHandler({enabled: isGa4SessionReadingEnabled, user: getCurrentUser,
  config: () => process.env.V22_API_BASE_URL && process.env.V22_INTERNAL_API_TOKEN
    ? {baseUrl: process.env.V22_API_BASE_URL, token: process.env.V22_INTERNAL_API_TOKEN} : null});
