import {getCurrentUser} from "@/lib/auth";
import {isGa4CollectionsEnabled} from "@/lib/ga4-comparison-collections/config";
import {createGa4ReviewHandlers} from "@/lib/ga4-evidence-reviews/handler";
export const dynamic = "force-dynamic";
export const {GET, POST} = createGa4ReviewHandlers({enabled: isGa4CollectionsEnabled, user: getCurrentUser,
  config: () => process.env.V22_API_BASE_URL && process.env.V22_INTERNAL_API_TOKEN
    ? {baseUrl: process.env.V22_API_BASE_URL, token: process.env.V22_INTERNAL_API_TOKEN} : null});
