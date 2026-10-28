export function isImplementationRecordsEnabled() {
  return process.env.V22_CAPABILITY_DISPATCH_ENABLED === "true" && process.env.V22_IMPLEMENTATION_RECORDS_ENABLED === "true";
}
