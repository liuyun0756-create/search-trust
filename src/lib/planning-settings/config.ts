export function isPlanningSettingsEnabled(){
  return process.env.V22_CAPABILITY_DISPATCH_ENABLED==="true" && process.env.V22_PLANNING_SETTINGS_ENABLED==="true";
}
