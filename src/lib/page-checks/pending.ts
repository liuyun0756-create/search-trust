import {exact, uuid} from "../implementation-records/contracts";
import {parsePageSelection, type PageCheckTarget} from "./contracts";
import type {PageCheckSelection} from "./types";

export type PendingPageCheck = {version: 1; checkId: string; selection: PageCheckSelection};
export const pendingPageKey = (owner: string, target: PageCheckTarget) =>
  `v22:page-check:1:${owner}:${target.caseId}:${target.reportId}:${target.deliveryRevisionId}`;
export function parsePendingPageCheck(raw: string | null): PendingPageCheck | null {
  if (!raw || raw.length > 24576) return null;
  try {
    const p = JSON.parse(raw);
    return p && typeof p === "object" && !Array.isArray(p) && exact(p, ["version", "checkId", "selection"])
      && p.version === 1 && uuid(p.checkId) && parsePageSelection(p.selection) ? p : null;
  } catch {return null;}
}
