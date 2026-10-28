import {isImplementationRecordsEnabled} from "../implementation-records/config";
export function isImplementationAttachmentsEnabled() {
  return isImplementationRecordsEnabled() && process.env.V22_IMPLEMENTATION_ATTACHMENTS_ENABLED === "true";
}
