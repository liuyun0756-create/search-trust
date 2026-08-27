import { NextRequest, NextResponse } from "next/server";

import { createServerClient } from "../supabase";
import { parseJobCallbackEvent, type JobCallbackEvent } from "./callback-contract";
import { verifyCallbackSignature } from "./callback-signature";
import {
  SupabaseJobEventRepository,
  type JobEventRepository,
} from "./repository";
import { runV22TerminalEffects } from "./terminal-effects";

interface HandlerDependencies {
  getSecret(): string;
  nowSeconds(): number;
  createRepository(): JobEventRepository;
  runTerminalEffects(event: JobCallbackEvent): Promise<void>;
}

function error(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function createJobEventHandler(dependencies: HandlerDependencies) {
  return {
    async POST(request: NextRequest) {
      const secret = dependencies.getSecret();
      if (!secret) return error("CALLBACK_NOT_CONFIGURED", "Job callbacks are not configured.", 503);

      const body = await request.text();
      const version = request.headers.get("x-searchtrust-signature-version") ?? "";
      const timestamp = request.headers.get("x-searchtrust-timestamp") ?? "";
      const signature = request.headers.get("x-searchtrust-signature") ?? "";
      const headerEventId = request.headers.get("x-searchtrust-event-id") ?? "";
      if (!verifyCallbackSignature({
        secret,
        timestamp,
        body,
        version,
        signature,
        nowSeconds: dependencies.nowSeconds(),
        allowedClockSkewSeconds: 300,
      })) return error("CALLBACK_AUTH_FAILED", "Job callback authentication failed.", 401);

      let event: JobCallbackEvent;
      try {
        event = parseJobCallbackEvent(JSON.parse(body));
      } catch {
        return error("INVALID_CALLBACK", "The job callback payload is invalid.", 400);
      }
      if (headerEventId !== event.event_id) {
        return error("CALLBACK_AUTH_FAILED", "Job callback authentication failed.", 401);
      }

      let result;
      try {
        result = await dependencies.createRepository().apply(event);
      } catch {
        return error("CALLBACK_PERSISTENCE_FAILED", "The job callback could not be saved.", 500);
      }
      if (!result.found) return error("JOB_NOT_FOUND", "The analysis job was not found.", 404);

      if (result.terminalEffectsApplied) {
        try {
          await dependencies.runTerminalEffects(event);
        } catch {
          return error("TERMINAL_EFFECT_FAILED", "The terminal job event could not be finalized.", 500);
        }
      }
      return NextResponse.json({
        ok: true,
        applied: result.applied,
        idempotent: !result.applied,
        state_revision: result.stateRevision,
        terminal_effects_applied: result.terminalEffectsApplied,
      });
    },
  };
}

export function createServerJobEventHandler() {
  return createJobEventHandler({
    getSecret: () => process.env.V22_JOB_CALLBACK_SECRET ?? "",
    nowSeconds: () => Math.floor(Date.now() / 1000),
    createRepository: () => new SupabaseJobEventRepository(createServerClient()),
    runTerminalEffects: runV22TerminalEffects,
  });
}
