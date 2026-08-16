import { REQUIRED_LAYER_KEYS } from "./layerConfig";
import type { ActionPriority, KeyIssue } from "./types";

const SEVERITY_PRIORITY: Record<ActionPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/**
 * Present key issues in repair order without mutating the report payload.
 *
 * Layer order is authoritative (L1 -> L8). Issues in the same layer are
 * ordered by severity, while equal-priority items preserve their source order.
 */
export function sortKeyIssuesByLayerPriority(
  issues: KeyIssue[] | null | undefined,
): KeyIssue[] {
  return (Array.isArray(issues) ? issues : [])
    .map((issue, sourceIndex) => ({ issue, sourceIndex }))
    .sort((left, right) => {
      const leftLayer = layerPriority(left.issue.affected_layer);
      const rightLayer = layerPriority(right.issue.affected_layer);
      if (leftLayer !== rightLayer) return leftLayer - rightLayer;

      const leftSeverity = SEVERITY_PRIORITY[left.issue.severity] ?? Number.MAX_SAFE_INTEGER;
      const rightSeverity = SEVERITY_PRIORITY[right.issue.severity] ?? Number.MAX_SAFE_INTEGER;
      if (leftSeverity !== rightSeverity) return leftSeverity - rightSeverity;

      return left.sourceIndex - right.sourceIndex;
    })
    .map(({ issue }) => issue);
}

function layerPriority(layerKey: KeyIssue["affected_layer"]): number {
  const index = REQUIRED_LAYER_KEYS.indexOf(layerKey);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}
