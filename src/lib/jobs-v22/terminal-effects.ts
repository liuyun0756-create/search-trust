import type { JobCallbackEvent } from "./callback-contract";

/**
 * V22-012 intentionally has no payment/report side effects. V22-041 will
 * extend the database transaction that claims a terminal revision.
 */
export async function runV22TerminalEffects(_event: JobCallbackEvent): Promise<void> {
  return undefined;
}

