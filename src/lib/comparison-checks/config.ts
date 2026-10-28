import {isImplementationRecordsEnabled} from "../implementation-records/config";
export const isComparisonChecksEnabled = () => isImplementationRecordsEnabled() && process.env.V22_COMPARISONS_ENABLED === "true";
