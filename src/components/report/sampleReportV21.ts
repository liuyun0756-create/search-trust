import type { Report } from "@/types/database";
import sampleReportV21 from "./sampleReportV21Data.json";

const statusCards = sampleReportV21 as {
  report_id: string;
  analyzed_url: string;
  page_type: string;
  generated_at: string;
  gbp_status: { status: string; gbp_url?: string | null };
  overall_status: { label: string; explanation: string };
  ranking_potential: { label: string; explanation: string };
  risk_level: { label: string; explanation: string };
};

export const SAMPLE_REPORT_V21: Report = {
  id: "sample-v21",
  report_id: statusCards.report_id,
  user_id: "sample",
  page_url: statusCards.analyzed_url,
  page_type: statusCards.page_type,
  gbp_url: statusCards.gbp_status.gbp_url ?? null,
  gbp_connected: statusCards.gbp_status.status === "checked",
  task_id: null,
  status: "paid_full",
  access_type: "unlocked",
  completed_at: statusCards.generated_at,
  trust_status: JSON.stringify({
    label: "Trust Status",
    value: statusCards.overall_status.label,
    description: statusCards.overall_status.explanation,
  }),
  ranking_potential: JSON.stringify({
    label: "Ranking Potential",
    value: statusCards.ranking_potential.label,
    description: statusCards.ranking_potential.explanation,
  }),
  risk_level: JSON.stringify({
    label: "Risk Level",
    value: statusCards.risk_level.label,
    description: statusCards.risk_level.explanation,
  }),
  generated_at: statusCards.generated_at,
  module_1_overview: null,
  module_2_page_level: null,
  module_3_key_problems: null,
  module_4_eight_layers: null,
  module_5_optimization: null,
  report_v2_1: sampleReportV21,
  created_at: statusCards.generated_at,
};
