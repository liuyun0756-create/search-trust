import {getCurrentUser} from "@/lib/auth";
import {isComparisonCollectionsEnabled} from "@/lib/comparison-collections/config";
import {createComparisonHandlers} from "@/lib/comparison-checks/handler";
export const dynamic = "force-dynamic";
export const {GET, POST} = createComparisonHandlers({kind: "collection", enabled: isComparisonCollectionsEnabled, user: getCurrentUser,
  config: () => process.env.V22_API_BASE_URL && process.env.V22_INTERNAL_API_TOKEN
    ? {baseUrl: process.env.V22_API_BASE_URL, token: process.env.V22_INTERNAL_API_TOKEN} : null});
