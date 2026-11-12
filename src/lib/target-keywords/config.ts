/** Server gate. Existing entry points and request shapes remain unchanged by default. */
export function isTargetKeywordsEnabled(){
 return process.env.V22_TARGET_KEYWORDS_ENABLED==='true'&&process.env.V22_CAPABILITY_DISPATCH_ENABLED==='true'
  &&process.env.V22_CAPABILITY_INTAKE_ENABLED==='true';
}
