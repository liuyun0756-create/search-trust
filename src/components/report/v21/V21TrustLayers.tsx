import {
  REQUIRED_LAYER_KEYS,
  getDisplayLayerFinding,
  getDisplaySignalsAssessed,
  getLayerDisplayConfig,
  type GBPStatusValue,
  type LayerFinding,
} from "@/lib/report-v21";
import { V21ActionItems } from "./V21ActionItems";
import { V21EvidenceList } from "./V21EvidenceList";
import { getLayerStatusLabel, getLayerStatusTone, safeList } from "./statusHelpers";
import { isAnalystView, type V21ViewMode } from "./viewMode";

export function V21TrustLayers({
  layers,
  gbpStatus,
  viewMode = "analyst",
}: {
  layers?: LayerFinding[] | null;
  gbpStatus?: GBPStatusValue | null;
  viewMode?: V21ViewMode;
}) {
  const showTechnical = isAnalystView(viewMode);
  const layerMap = new Map(safeList(layers).map((layer) => [layer.layer_key, layer]));
  const orderedLayers = REQUIRED_LAYER_KEYS.map((layerKey, index) => {
    const config = getLayerDisplayConfig(layerKey);
    const layer = layerMap.get(layerKey) || {
      layer_id: index + 1,
      layer_key: layerKey,
      layer_name: config.name,
      layer_label: config.label,
      status: "not_checked" as const,
      checked_rule_ids: [],
      triggered_rule_ids: [],
      summary: "This layer was not available in the report payload.",
      explanation: "No structured layer finding was available.",
      evidence_items: [],
      suggested_fixes: [],
      action_items: [],
    };
    return getDisplayLayerFinding(layer, gbpStatus);
  });

  if (!showTechnical) {
    return (
      <div className="space-y-5">
        <div className="rounded-[20px] border border-[#E4EDD2] bg-[#FBFDF5] p-5">
          <h3 className="text-[20px] font-black tracking-tight text-[#1A212B]">Eight trust layers</h3>
          <p className="mt-2 text-[14px] font-medium leading-relaxed text-gray-600">
            These eight signals show where the page is ready to compete and where trust needs to be strengthened first.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {orderedLayers.map((layer) => {
            const config = getLayerDisplayConfig(layer.layer_key);
            const findingCount = safeList(layer.triggered_rule_ids).length;
            return (
              <article key={layer.layer_key} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-gray-400">{config.label}</p>
                <p className="mt-2 text-[13px] font-semibold text-gray-500">
                  Findings requiring attention:{" "}
                  <span className="font-black text-[#1A212B]">{findingCount}</span>
                </p>
                <span className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase ${getLayerStatusTone(layer.status)}`}>
                  {getLayerStatusLabel(layer.status)}
                </span>
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[20px] border border-[#E4EDD2] bg-[#FBFDF5] p-5">
        <h3 className="text-[20px] font-black tracking-tight text-[#1A212B]">8-Layer Trust Model</h3>
        <p className="mt-2 text-[14px] font-medium leading-relaxed text-gray-600">
          The report evaluates all eight trust layers in order, including entity presence and entity consistency as first-class layers.
        </p>
      </div>

      {orderedLayers.map((layer) => {
        const findingCount = safeList(layer.triggered_rule_ids).length;
        const structuredFindings = safeList(layer.triggered_findings);
        const actionFindings = safeList(layer.action_items).flatMap((action) => safeList(action.addressed_findings));
        const displayFindings = Array.from(new Set(
          (structuredFindings.length > 0 ? structuredFindings : actionFindings)
            .filter(Boolean)
        ));
        const visibleFindings = displayFindings.length > 0 ? displayFindings : [layer.summary];
        const presentationMode = layer.presentation_mode
          || (layer.status === "good"
            ? findingCount === 0 ? "healthy" : "healthy_with_opportunities"
            : "attention");
        const isHealthy = presentationMode === "healthy";
        const isHealthyWithOpportunities = presentationMode === "healthy_with_opportunities";
        const metricLabel = layer.status === "good" ? "Improvement opportunities" : "Findings requiring attention";
        const findingsTitle = isHealthyWithOpportunities ? "Opportunities to strengthen" : "What needs attention";
        const fixesTitle = isHealthyWithOpportunities ? "Recommended enhancements" : "Suggested fixes";
        const actionTitle = isHealthyWithOpportunities ? "Recommended enhancements" : "Consolidated layer actions";

        return (
          <article key={layer.layer_key} className="rounded-[24px] border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-1 text-[12px] font-black uppercase tracking-[0.14em] text-gray-400">{getLayerDisplayConfig(layer.layer_key).label}</p>
              <h4 className="text-[20px] font-black tracking-tight text-[#1A212B]">{getLayerDisplayConfig(layer.layer_key).name}</h4>
            </div>
            <span className={`rounded-full border px-3 py-1.5 text-[12px] font-black uppercase ${getLayerStatusTone(layer.status)}`}>
              {getLayerStatusLabel(layer.status)}
            </span>
          </div>

          <p className="mb-3 text-[14px] font-bold leading-relaxed text-[#1A212B]">{layer.summary}</p>
          <p className="mb-4 text-[14px] font-medium leading-relaxed text-gray-600">{layer.explanation}</p>

          {showTechnical && (
            <div className="mb-4 flex flex-wrap gap-2">
              <Metric label="Signals assessed" value={getDisplaySignalsAssessed(layer)} />
              <Metric label={metricLabel} value={findingCount} />
            </div>
          )}

          {showTechnical && findingCount > 0 && (
            <div className={`mb-4 rounded-2xl border p-4 ${isHealthyWithOpportunities ? "border-[#DDE9C4] bg-[#FBFDF5]" : "border-amber-100 bg-amber-50/40"}`}>
              <p className={`mb-3 text-[12px] font-black uppercase tracking-[0.12em] ${isHealthyWithOpportunities ? "text-[#6F8F16]" : "text-amber-700"}`}>
                {findingsTitle} ({findingCount})
              </p>
              <ul className="grid grid-cols-1 gap-x-6 gap-y-2 lg:grid-cols-2">
                {visibleFindings.map((finding, index) => (
                  <li key={`${finding}-${index}`} className="flex gap-2 text-[13px] font-medium leading-relaxed text-gray-700">
                    <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${isHealthyWithOpportunities ? "bg-[#A5D020]" : "bg-amber-500"}`} />
                    <span>{finding}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!isHealthy && safeList(layer.suggested_fixes).length > 0 && (
            <div className="mb-4 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
              <p className="mb-2 text-[12px] font-black uppercase tracking-[0.12em] text-gray-400">{fixesTitle}</p>
              <ul className="space-y-1.5">
                {safeList(layer.suggested_fixes).map((fix, index) => (
                  <li key={`${fix}-${index}`} className="flex gap-2 text-[13px] font-medium leading-relaxed text-gray-600">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#A5D020]" />
                    <span>{fix}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {showTechnical ? (
            <div className="space-y-3">
              <V21EvidenceList evidenceItems={layer.evidence_items} viewMode={viewMode} />
              <V21ActionItems actions={layer.action_items} title={actionTitle} viewMode={viewMode} />
            </div>
          ) : null}
          </article>
        );
      })}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full border border-gray-100 bg-gray-50 px-3 py-1.5 text-[12px] font-bold text-gray-500">
      {label}: {value}
    </span>
  );
}
