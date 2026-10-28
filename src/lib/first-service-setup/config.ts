import { isV22PublicEntryEnabled } from "@/lib/release-v22/public-entry";

export function isFirstServiceSetupAvailable(): boolean {
  return (
    process.env.V22_FIRST_SERVICE_SETUP_ENABLED === "true" &&
    process.env.GOOGLE_CONNECTIONS_ENABLED === "true"
  );
}

/** Preparation only. This flag never enables paid first-service intake. */
export function isFirstServiceSetupEnabled(): boolean {
  return isFirstServiceSetupAvailable() && isV22PublicEntryEnabled();
}
