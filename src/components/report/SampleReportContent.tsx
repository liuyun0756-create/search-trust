"use client";

import { ReportContent } from "./ReportContent";
import type { Report } from "@/types/database";

const SAMPLE_REPORT: Report = {
  id: "sample-001",
  report_id: "SAMPLE-001",
  user_id: "sample",
  page_url: "https://simpleanalytics.com/pricing",
  page_type: "Service Page",
  gbp_url: "https://www.google.com/maps/search/?api=1&query=SimpleAnalytics",
  task_id: null,
  status: "paid_full",
  trust_status: JSON.stringify({ label: "Trust Status", value: "Medium-Low", description: "The page has some local relevance, but its trust structure is still incomplete and ranking stability remains weak." }),
  ranking_potential: JSON.stringify({ label: "Ranking Potential", value: "High", description: "The page has a solid foundation and, with further optimization, can move into a stronger competitive tier." }),
  risk_level: JSON.stringify({ label: "Risk Level", value: "Medium", description: "The page has some weaknesses, but it still retains room for repair and optimization." }),
  generated_at: "2026-05-15 15:05",
  module_1_overview: {
    primary_blocking_layer: "Entity Presence (L0-A)",
    current_status: "Medium",
    ranking_potential: "Strong competitive potential",
    risk_level: "Medium-High risk",
    main_conclusion:
      "Your page qualifies for local search competition, but is not yet a high-trust local business page.",
    explanation:
      "The page has foundational capabilities, such as a clear topic and service direction, but shows visible gaps in entity presence and specificity. These gaps cause the page to be interpreted as lacking real-world identity traces, limiting trust accumulation and ranking stability in local search.",
  },
  module_2_page_level: {
    page_level: "Moderately weak",
    current_assessment:
      "The page has some local search competition foundation, but trust structure is thin, especially in entity feel and specificity.",
    existing_foundation:
      "The page has built basic capabilities such as clear topic direction and good algorithm adaptation.",
    main_limitation:
      "The page has not yet established strong entity presence or real-world anchors.",
    likely_search_outcome:
      "In low-competition environments, the page may gain some ranking opportunities, but in high-competition settings, it will struggle against pages with higher trust.",
    competitive_interpretation:
      "Against stronger competitors, the trust gap will be amplified, especially in queries requiring entity verification and specific scenario support.",
  },
  module_3_key_problems: {
    primary_trust_failure: {
      blocking_layer: "Entity Presence (L0-A)",
      description:
        "The page reads as having only service claims without entity grounding — lacking basic identity information, more like a keyword entry than a business entry.",
    },
    concrete_issues: [
      {
        title: "Weak Entity Presence",
        judgement: "Google cannot clearly determine whether a distinct local entity exists behind this page.",
        explanation: "The page lacks parseable physical address and business hours, making it difficult for search systems to complete basic entity identification.",
        impacts: ["Page lacks real-world anchor strength.", "Reduced map verifiability and local credibility signals."],
        suggestions: ["Add complete street address with schema LocalBusiness + address structured data.", "Present consistent NAP information (Name / Address / Phone) in the footer."],
      },
      {
        title: "Insufficient Page Specificity",
        judgement: "Google cannot clearly determine whether this page exists due to real-world context.",
        explanation: "Page content is highly generic, lacking local context language, landmark entities, and service radius descriptions.",
        impacts: ["Page lacks local scenario feel and service details.", "Easily flagged as scalable, non-exclusive content."],
        suggestions: ["Add local climate characteristics or common local problem descriptions.", "Describe proximity to landmarks and use real service cases."],
      },
    ],
  },
  module_4_eight_layers: {
    layers: [
      { layer_key: "foundation", layer_name: "Foundation", status: "Good", description: "The page has clear topic direction and service positioning." },
      { layer_key: "entity_presence", layer_name: "Entity Presence", status: "Fair", description: "The page still has gaps in entity presence." },
      { layer_key: "entity_consistency", layer_name: "Entity Consistency", status: "Good", description: "The page performs well in entity information consistency." },
      { layer_key: "specificity", layer_name: "Specificity", status: "Fair", description: "Page content is too generic, lacking local context language." },
      { layer_key: "real_world_connection", layer_name: "Real-World Connection", status: "Fair", description: "The page has weak connection to geographic space." },
      { layer_key: "accountability", layer_name: "Accountability", status: "Weak", description: "The page focuses more on meeting search demand than taking real-world responsibility." },
      { layer_key: "page_unique_value", layer_name: "Page Unique Value", status: "Good", description: "The page has some independent value." },
      { layer_key: "algorithm_fit", layer_name: "Algorithm Fit", status: "Good", description: "The page performs well under current search algorithms." },
    ],
  },
  module_5_optimization: {
    primary_trust_blocker: {
      blocking_layer: "Entity Presence (L0-A)",
      summary: "The core reason for poor page performance is insufficient entity presence.",
      direct_consequences: ["Page lacks real-world identity traces.", "Reduced map verifiability.", "Page reads more like a keyword entry than a business entry."],
      why_cannot_skip: "Without first resolving entity presence, trust accumulation and optimization absorption will be significantly limited.",
    },
    must_execute_now: {
      title: "Must Execute Now",
      items: [
        {
          title: "1. Strengthen Entity Presence",
          why_now: "Entity presence is the foundation of page trust structure.",
          execution_focus: ["Add complete street address with LocalBusiness schema.", "Present consistent NAP information in footer.", "Add business hours module consistent with Google Business Profile."],
          completion_signals: ["Page contains complete address and business hours.", "Google can identify entity information through structured data."],
          expected_impact: ["Improved entity recognition.", "Enhanced local credibility and map verifiability."],
        },
         {
          title: "2. Strengthen Entity Presence",
          why_now: "Entity presence is the foundation of page trust structure.",
          execution_focus: ["Add complete street address with LocalBusiness schema.", "Present consistent NAP information in footer.", "Add business hours module consistent with Google Business Profile."],
          completion_signals: ["Page contains complete address and business hours.", "Google can identify entity information through structured data."],
          expected_impact: ["Improved entity recognition.", "Enhanced local credibility and map verifiability."],
        },
         {
          title: "3. Strengthen Entity Presence",
          why_now: "Entity presence is the foundation of page trust structure.",
          execution_focus: ["Add complete street address with LocalBusiness schema.", "Present consistent NAP information in footer.", "Add business hours module consistent with Google Business Profile."],
          completion_signals: ["Page contains complete address and business hours.", "Google can identify entity information through structured data."],
          expected_impact: ["Improved entity recognition.", "Enhanced local credibility and map verifiability."],
        },
      ],
    },
    roadmap: [
      {
        phase_title: "Enhance Page Specificity",
        entry_condition: "Entity presence and consistency are basically stable.",
        goal: "Improve local scenario feel and service details.",
        key_actions: ["Add local climate or common local problem descriptions.", "Describe proximity to landmarks with real service cases.", "Specify service distance (mile/km) with real administrative areas."],
        expected_outcomes: ["Significantly enhanced local scenario feel.", "Page understood as more exclusive and locally relevant."],
      },
    ],
  },
  created_at: new Date().toISOString(),
};

export function SampleReportContent() {
  return (
    <section className="bg-[#F8F9FA] py-20">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-gray-100 shadow-sm mb-6">
            <div className="w-2 h-2 rounded-full bg-[#A5D020]" />
            <span className="text-[11px] font-black uppercase tracking-widest text-gray-500">Sample Report</span>
          </div>
          <h2 className="text-[36px] font-bold text-[#1A212B] tracking-tighter mb-3">
            Full Trust Audit Example
          </h2>
          <p className="text-[15px] text-[#6B7280] font-medium max-w-lg mx-auto">
            This is a sample report showing all five stages unlocked. Your reports will follow the same structure.
          </p>
        </div>
        <ReportContent
          report={SAMPLE_REPORT}
          isPaid={true}
          isLoading={false}
        />
      </div>
    </section>
  );
}
