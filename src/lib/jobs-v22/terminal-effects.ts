import type { JobCallbackEvent } from "./callback-contract";

/**
 * Case entitlement consumption/refunds are applied inside the same database
 * transaction that claims a terminal revision. Non-database terminal effects
 * can be added here without weakening that atomic boundary.
 */
export async function runV22TerminalEffects(_event: JobCallbackEvent): Promise<void> {
  return undefined;
}
