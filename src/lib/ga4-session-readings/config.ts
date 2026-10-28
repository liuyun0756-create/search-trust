import {isGa4CollectionsEnabled} from "../ga4-comparison-collections/config";
export const isGa4SessionReadingEnabled = () => isGa4CollectionsEnabled() && process.env.V22_GA4_SESSION_SNAPSHOT_READING_ENABLED === "true";
