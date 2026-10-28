import {isComparisonChecksEnabled} from "../comparison-checks/config";
export const isComparisonCollectionsEnabled = () => isComparisonChecksEnabled() && process.env.V22_COMPARISON_COLLECTIONS_ENABLED === "true";
