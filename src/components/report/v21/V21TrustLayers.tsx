import { REQUIRED_LAYER_KEYS, getLayerDisplayConfig, type LayerFinding } from "@/lib/report-v21";
import { V21ActionItems } from "./V21ActionItems";
import { V21EvidenceList } from "./V21EvidenceList";
import { getLayerStatusLabel, getLayerStatusTone, safeList } from "./statusHelpers";
import { isAnalystView, type V21ViewMode } from "./viewMode";

export function V21TrustLayers({
  layers,
  viewMode = "analyst",
}: {
  layers?: LayerFinding[] | null;
  viewMode?: V21ViewMode;
}) {
  const showTechnical = isAnalystView(viewMode);
  const layerMap = new Map(safeList(layers).map((layer) => [layer.layer_key, layer]));
  const orderedLayers = REQUIRED_LAYER_KEYS.map((layerKey, index) => {
    const config = getLayerDisplayConfig(layerKey);
    return layerMap.get(layerKey) || {
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
  });

  return (
    <div className="space-y-5">
      <div className="rounded-[20px] border border-[#E4EDD2] bg-[#FBFDF5] p-5">
        <h3 className="text-[20px] font-black tracking-tight text-[#1A212B]">8-Layer Trust Model</h3>
        <p className="mt-2 text-[14px] font-medium leading-relaxed text-gray-600">
          The report evaluates all eight trust layers in order, including entity presence and entity consistency as first-class layers.
        </p>
      </div>

      {orderedLayers.map((layer) => (
        <article key={layer.layer_key} className="rounded-[24px] border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-1 text-[12px] font-black uppercase tracking-[0.14em] text-gray-400">{layer.layer_label}</p>
              <h4 className="text-[20px] font-black tracking-tight text-[#1A212B]">{layer.layer_name}</h4>
            </div>
            <span className={`rounded-full border px-3 py-1.5 text-[12px] font-black uppercase ${getLayerStatusTone(layer.status)}`}>
              {getLayerStatusLabel(layer.status)}
            </span>
          </div>

          <p className="mb-3 text-[14px] font-bold leading-relaxed text-[#1A212B]">{layer.summary}</p>
          <p className="mb-4 text-[14px] font-medium leading-relaxed text-gray-600">{layer.explanation}</p>

          {showTechnical && (
            <div className="mb-4 flex flex-wrap gap-2">
              <Metric label="Checked rules" value={safeList(layer.checked_rule_ids).length} />
              <Metric label="Triggered rules" value={safeList(layer.triggered_rule_ids).length} />
            </div>
          )}

          {safeList(layer.suggested_fixes).length > 0 && (
            <div className="mb-4 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
              <p className="mb-2 text-[12px] font-black uppercase tracking-[0.12em] text-gray-400">Suggested fixes</p>
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
              <V21ActionItems actions={layer.action_items} title="Layer actions" viewMode={viewMode} />
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-100 bg-gray-50/60 px-4 py-3">
              <p className="text-[13px] font-medium text-gray-600">
                {safeList(layer.evidence_items).length} evidence item(s) and {safeList(layer.action_items).length} action item(s) available in Analyst View.
              </p>
            </div>
          )}
        </article>
      ))}
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
