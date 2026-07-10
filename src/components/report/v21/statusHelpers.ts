import { getLayerDisplayConfig } from "@/lib/report-v21";
import type { ActionPriority, LayerKey, LayerStatus, RiskLevelValue } from "@/lib/report-v21";

export function getLayerStatusLabel(status: LayerStatus): string {
  const labels: Record<LayerStatus, string> = {
    good: "Good",
    medium: "Medium",
    weak: "Weak",
    not_checked: "Not checked",
  };
  return labels[status] || "Not checked";
}

export function getLayerStatusTone(status: LayerStatus): string {
  const tones: Record<LayerStatus, string> = {
    good: "border-emerald-100 bg-emerald-50 text-emerald-700",
    medium: "border-amber-100 bg-amber-50 text-amber-700",
    weak: "border-red-100 bg-red-50 text-red-700",
    not_checked: "border-gray-100 bg-gray-50 text-gray-500",
  };
  return tones[status] || tones.not_checked;
}

export function getRiskTone(level: RiskLevelValue | string): string {
  if (level === "low") return "text-emerald-600";
  if (level === "medium_high" || level === "high") return "text-red-600";
  return "text-amber-600";
}

export function getPriorityTone(priority: ActionPriority | string): string {
  if (priority === "high") return "border-red-100 bg-red-50 text-red-700";
  if (priority === "low") return "border-gray-100 bg-gray-50 text-gray-600";
  return "border-amber-100 bg-amber-50 text-amber-700";
}

export function formatLayerKey(layerKey: LayerKey | string): string {
  return getLayerDisplayConfig(layerKey).label;
}

export function sourceLabel(source: string): string {
  if (source === "native") return "Native v2.1";
  if (source === "legacy_adapted") return "Legacy adapted";
  return "Fallback";
}

export function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

export function safeList<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}
