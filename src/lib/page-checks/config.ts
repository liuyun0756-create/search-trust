import {isImplementationRecordsEnabled} from "../implementation-records/config";

export const isPageChecksEnabled = () => isImplementationRecordsEnabled() && process.env.V22_PAGE_CHECKS_ENABLED === "true";
