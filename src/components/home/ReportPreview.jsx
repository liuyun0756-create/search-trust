"use client";

import React, { useState } from "react";

const tabs = [
  {
    label: "Overall Conclusion",
    title: "Overall Conclusion",
    content: (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Trust status", "Medium Weak", "text-blue-600"],
            ["Ranking potential", "Strong", "text-emerald-600"],
            ["Risk level", "Medium", "text-amber-600"],
          ].map(([label, value, color]) => (
            <div key={label} className="rounded-lg border border-gray-100 bg-white p-5">
              <span className="mb-2 block text-[11px] font-black uppercase text-gray-400">{label}</span>
              <strong className={`text-[18px] ${color}`}>{value}</strong>
            </div>
          ))}
        </div>

        <div className="grid gap-4 rounded-lg border border-[#E3E9D1] bg-[#F8FAF1] p-5 md:grid-cols-2">
          <div>
            <span className="mb-2 block text-[11px] font-black uppercase text-gray-400">Primary blocking layer</span>
            <strong className="text-[15px] text-[#1A1F2B]">L3 Entity Consistency</strong>
          </div>
          <div>
            <span className="mb-2 block text-[11px] font-black uppercase text-gray-400">First priority</span>
            <strong className="text-[15px] text-[#1A1F2B]">Align the business identity signals</strong>
          </div>
        </div>
      </div>
    ),
  },
  {
    label: "Page Level",
    title: "Page-Level Interpretation",
    content: (
      <div className="grid gap-4 md:grid-cols-2">
        {[
          ["Existing foundation", "The page clearly communicates its service purpose and commercial intent."],
          ["Main limitation", "Identity and local proof need to be stabilized before broader content expansion."],
          ["Likely outcome", "The page can compete, but trust may remain uneven until the earlier layers improve."],
          ["Competitive interpretation", "Pages with cleaner identity and stronger local proof are easier to defend."],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-gray-100 bg-white p-5">
            <h4 className="mb-2 text-[12px] font-black uppercase text-[#7FA40F]">{label}</h4>
            <p className="text-[14px] leading-relaxed text-gray-600">{value}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    label: "Key Issues",
    title: "Confirmed Issues and Actions",
    content: (
      <div className="space-y-3">
        {[
          ["L3 Entity Consistency", "Address alignment needs correction", "Standardize the checked address across visible and structured placements."],
          ["L4 Specificity", "The page reads like a reusable service template", "Add a verified local service case with concrete work details."],
        ].map(([layer, issue, action]) => (
          <div key={issue} className="grid gap-3 rounded-lg border border-gray-100 bg-white p-5 md:grid-cols-[180px_1fr_1fr]">
            <strong className="text-[13px] text-[#B45309]">{layer}</strong>
            <span className="text-[14px] font-bold text-[#1A1F2B]">{issue}</span>
            <span className="text-[14px] text-gray-600">{action}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    label: "Trust Layer Breakdown",
    title: "Complete L1-L8 Trust Breakdown",
    content: (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["L1", "Foundation", "Good"],
          ["L2", "Entity Presence", "Good"],
          ["L3", "Entity Consistency", "Medium"],
          ["L4", "Specificity", "Weak"],
          ["L5", "Real-World Connection", "Medium"],
          ["L6", "Accountability", "Medium"],
          ["L7", "Page Unique Value", "Good"],
          ["L8", "Algorithm Fit", "Good"],
        ].map(([id, name, status]) => (
          <div key={id} className="rounded-lg border border-gray-100 bg-[#F8F9FA] p-4">
            <span className="text-[12px] font-black text-[#7FA40F]">{id}</span>
            <h4 className="my-1 text-[14px] font-bold text-[#1A1F2B]">{name}</h4>
            <span className={`text-[12px] font-bold ${status === "Weak" ? "text-red-600" : status === "Medium" ? "text-amber-600" : "text-emerald-600"}`}>
              {status}
            </span>
          </div>
        ))}
      </div>
    ),
  },
  {
    label: "Implementation Roadmap",
    title: "Four-Phase Implementation Roadmap",
    content: (
      <div className="grid gap-3 md:grid-cols-4">
        {[
          ["01", "L1-L3", "Stabilize the business entity"],
          ["02", "L4-L5", "Build local credibility"],
          ["03", "L6-L7", "Add accountable, unique proof"],
          ["04", "L8", "Reassess search-era fit"],
        ].map(([step, range, title]) => (
          <div key={step} className="rounded-lg border border-gray-100 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#A5D020] text-[12px] font-black text-[#1A1F2B]">{step}</span>
              <span className="text-[11px] font-black text-gray-400">{range}</span>
            </div>
            <strong className="text-[14px] leading-snug text-[#1A1F2B]">{title}</strong>
          </div>
        ))}
      </div>
    ),
  },
  {
    label: "Business Presence Audit",
    title: "Supplemental Business Presence Audit",
    content: (
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["GBP × Page Alignment", "Compares available name, phone, address, website, hours, service area, and category fields."],
          ["Profile Activity", "Shows returned profile categories, photos, and posts without inventing missing dates."],
          ["Review Operations", "Summarizes a recent review sample, reply workload, rating distribution, and usable proof opportunities."],
        ].map(([title, value]) => (
          <div key={title} className="rounded-lg border border-gray-100 bg-[#F8F9FA] p-5">
            <h4 className="mb-2 text-[14px] font-bold text-[#1A1F2B]">{title}</h4>
            <p className="text-[13px] leading-relaxed text-gray-600">{value}</p>
          </div>
        ))}
        <p className="md:col-span-3 text-[12px] font-semibold text-gray-500">
          This section is availability-based and does not change the fixed L1-L8 score.
        </p>
      </div>
    ),
  },
];

export function ReportPreview() {
  const [activeTab, setActiveTab] = useState(0);
  const current = tabs[activeTab];

  return (
    <section className="bg-[#F8F9FB] py-20">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="text-[36px] font-bold text-[#1A1F2B] md:text-[44px]">Inside the Agency Audit</h2>
          <div className="section-title-bar" />
          <p className="mx-auto mt-5 max-w-3xl text-[16px] leading-relaxed text-gray-500">
            One working report connects the decision summary, confirmed findings, source evidence, layer actions, and implementation order.
          </p>
        </div>

        <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.05)] md:p-7">
          <div className="mb-7 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            {tabs.map((tab, index) => (
              <button
                key={tab.label}
                type="button"
                onClick={() => setActiveTab(index)}
                className={`min-h-[64px] rounded-lg px-3 py-3 text-[12px] font-bold leading-tight transition ${
                  activeTab === index
                    ? "bg-[#1A1F2B] text-white shadow-lg"
                    : "bg-[#F3F4F6] text-gray-500 hover:bg-gray-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-gray-100 bg-[#FBFCFD] p-5 md:p-8">
            <h3 className="mb-6 text-[22px] font-bold text-[#1A1F2B]">{current.title}</h3>
            {current.content}
          </div>
        </div>
      </div>
    </section>
  );
}
