import {isComparisonChecksEnabled} from "../comparison-checks/config";
export const isGa4CollectionsEnabled = () => isComparisonChecksEnabled() && process.env.V22_GA4_COMPARISON_COLLECTIONS_ENABLED === "true";
