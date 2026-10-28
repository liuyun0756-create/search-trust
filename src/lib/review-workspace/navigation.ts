import { uuid } from "../implementation-records/contracts";
import type { Target } from "./types";
export type WorkspaceLocation = { target?: Target; reviewId?: string };
export function parseLocation(
  query: Record<string, string | string[] | undefined>,
): WorkspaceLocation | null {
  if (
    Object.keys(query).some(
      (k) =>
        ![
          "deliveryRevisionId",
          "implementationId",
          "implementationRevision",
          "reviewId",
        ].includes(k),
    ) ||
    Object.values(query).some((v) => Array.isArray(v))
  )
    return null;
  const {
    deliveryRevisionId: d,
    implementationId: i,
    implementationRevision: r,
    reviewId: s,
  } = query;
  if (s !== undefined)
    return uuid(s) && d === undefined && i === undefined && r === undefined
      ? { reviewId: s }
      : null;
  if (d === undefined && i === undefined && r === undefined) return {};
  if (
    !uuid(d) ||
    !uuid(i) ||
    typeof r !== "string" ||
    !/^[1-9]\d*$/.test(r) ||
    !Number.isSafeInteger(Number(r)) ||
    Number(r) > 2147483646
  )
    return null;
  return {
    target: {
      delivery_id: d,
      implementation_id: i,
      implementation_revision: Number(r),
    },
  };
}
export function locationQuery(location: WorkspaceLocation) {
  return location.reviewId
    ? `?reviewId=${encodeURIComponent(location.reviewId)}`
    : location.target
      ? `?${new URLSearchParams({ deliveryRevisionId: location.target.delivery_id, implementationId: location.target.implementation_id, implementationRevision: String(location.target.implementation_revision) })}`
      : "";
}
