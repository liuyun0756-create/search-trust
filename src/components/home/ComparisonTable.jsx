import React from 'react';
import { Check, Minus } from 'lucide-react';

const capabilities = [
  { name: "Layer-by-layer trust diagnosis", status: [false, false, false, false, true] },
  { name: "Entity attribution analysis", status: [false, false, false, false, true] },
  { name: "NAP consistency audit", status: [false, true, false, true, true] },
  { name: "Behavioral trust signals", status: [false, false, true, false, true] },
  { name: "Trust-context link analysis", status: [true, true, false, false, true] },
  { name: "Intent-to-page fit scoring", status: [false, false, false, false, true] },
  { name: "Specific remediation per finding", status: [false, false, false, false, true] },
  { name: "Local page focus", status: [false, true, false, true, true] },
];

const competitors = [
  { name: "Ahrefs", sub: "Backlink / SEO" },
  { name: "Semrush", sub: "All-in-one SEO" },
  { name: "GSC", sub: "Google Analytics" },
  { name: "BrightLocal", sub: "Local Citations" },
  { name: "SearchTrust", sub: "Trust Diagnosis", highlight: true },
];

export function ComparisonTable() {
  return (
    <section className="py-20 bg-[#F7F9FA]">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-[32px] md:text-[40px] font-bold text-[#1A1F2B]">
            How SearchTrust differs from other SEO tools
          </h2>
          <div className="section-title-bar" />
        </div>

        <div className="max-w-6xl mx-auto overflow-x-auto">
          <table className="w-full border-collapse bg-white">
            <thead className="bg-[#F9FAFB]">
              <tr>
                <th className="text-left py-6 px-6 text-[12px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
                  Capability
                </th>
                {competitors.map((comp, i) => (
                  <th 
                    key={i} 
                    className={`py-6 px-4 border-b border-gray-100 text-center min-w-[140px] ${comp.highlight ? 'bg-[#F9FAFB]' : ''}`}
                  >
                    <div className="text-[15px] font-bold text-[#1A1F2B] mb-1">{comp.name}</div>
                    <div className="text-[12px] text-gray-400 font-medium whitespace-nowrap">{comp.sub}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {capabilities.map((cap, rowIndex) => (
                <tr key={rowIndex} className="group hover:bg-gray-50/50 transition-colors">
                  <td className="py-5 px-6 text-[15px] font-medium text-gray-700 border-b border-gray-100">
                    {cap.name}
                  </td>
                  {cap.status.map((isChecked, colIndex) => (
                    <td 
                      key={colIndex} 
                      className={`py-5 px-4 border-b border-gray-100 text-center ${competitors[colIndex].highlight ? 'bg-[#F9FAFB]' : ''}`}
                    >
                      <div className="flex justify-center">
                        {isChecked ? (
                          <div className="w-6 h-6 rounded-full border-2 border-[#A5D020] flex items-center justify-center bg-white shadow-sm">
                            <Check size={14} className="text-[#A5D020] stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center bg-gray-50/50">
                            <Minus size={12} className="text-gray-300" />
                          </div>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
