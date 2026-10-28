import { isFirstServiceSetupAvailable } from "./config";
import { isV22PublicEntryEnabled } from "../release-v22/public-entry";

/** Existing paid work remains readable/continuable while NEW intake is paused. */
export function isFirstServiceEntryAvailable() {
  return (
    isFirstServiceSetupAvailable() &&
    process.env.V22_FIRST_SERVICE_ENTRY_ENABLED === "true" &&
    process.env.V22_CAPABILITY_DISPATCH_ENABLED === "true"
  );
}
export function isFirstServiceEntryEnabled() {
  return isFirstServiceEntryAvailable() && isV22PublicEntryEnabled();
}
