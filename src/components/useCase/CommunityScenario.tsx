"use client";

import { motion } from "framer-motion";
import {
  ArrowUpRight,
  MapPinned,
  MessageSquareQuote,
  ScanSearch,
  ShieldCheck,
} from "lucide-react";

const discussionPoints = [
  "Search proximity and the location of the person searching",
  "GBP prominence, category fit, reviews, and local competition",
  "Whether the page and business entity send consistent local signals",
];

export function CommunityScenario() {
  return (
    <section
      id="community-scenario"
      className="scroll-mt-28 overflow-hidden bg-white py-20"
    >
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.45 }}
          className="relative overflow-hidden rounded-[36px] border border-[#DDE6C9] bg-[#F7F9F2] shadow-[0_26px_70px_rgba(26,31,43,0.08)]"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-55"
            aria-hidden="true"
            style={{
              backgroundImage:
                "radial-gradient(circle at 13% 16%, rgba(165,208,32,0.18), transparent 28%), radial-gradient(circle at 88% 8%, rgba(26,31,43,0.08), transparent 24%)",
            }}
          />

          <div className="relative grid lg:grid-cols-[0.92fr_1.08fr]">
            <div className="flex flex-col justify-between border-b border-[#DDE6C9] p-8 sm:p-10 lg:border-b-0 lg:border-r lg:p-12">
              <div>
                <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#CAD99D] bg-white/80 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#647A20]">
                  <MessageSquareQuote size={15} aria-hidden="true" />
                  Real-world local SEO question
                </div>

                <p className="mb-4 text-[12px] font-black uppercase tracking-[0.18em] text-[#8A95A7]">
                  Community scenario 01
                </p>
                <h2 className="max-w-[620px] text-[34px] font-bold leading-[1.08] tracking-[-0.035em] text-[#1A1F2B] sm:text-[42px] lg:text-[48px]">
                  Page 1 organically. Missing from the Map Pack. Why?
                </h2>

                <p className="mt-7 max-w-[600px] text-[16px] font-medium leading-[1.75] text-[#596275]">
                  A local business owner described a page that already appeared on the first
                  organic results page, while its local Map Pack visibility remained weak and
                  inconsistent. They were also considering more hyperlocal pages as the next move.
                </p>
              </div>

              <div className="mt-10 rounded-[24px] border border-white/80 bg-white/75 p-6 backdrop-blur-sm">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EDF5D4] text-[#6E8D12]">
                    <MapPinned size={19} aria-hidden="true" />
                  </div>
                  <h3 className="text-[17px] font-bold text-[#1A1F2B]">The observed problem</h3>
                </div>
                <p className="text-[14px] leading-7 text-[#626C7E]">
                  Organic ranking, geo-grid visibility, and GBP performance were telling
                  different stories. Adding more pages would not, by itself, explain which trust
                  signal was holding the local result back.
                </p>
              </div>
            </div>

            <div className="p-8 sm:p-10 lg:p-12">
              <div className="grid gap-5">
                <article className="rounded-[24px] border border-[#E4E8DF] bg-white p-6 shadow-[0_8px_30px_rgba(26,31,43,0.04)]">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3F4F6] text-[#505B6D]">
                      <MessageSquareQuote size={18} aria-hidden="true" />
                    </div>
                    <h3 className="text-[18px] font-bold text-[#1A1F2B]">
                      What the community debated
                    </h3>
                  </div>
                  <ul className="grid gap-3 text-[14px] leading-6 text-[#5F697B] sm:grid-cols-3">
                    {discussionPoints.map((point) => (
                      <li key={point} className="relative border-l-2 border-[#B7DC43] pl-4">
                        {point}
                      </li>
                    ))}
                  </ul>
                </article>

                <div className="grid gap-5 sm:grid-cols-2">
                  <article className="rounded-[24px] bg-[#1A1F2B] p-6 text-white shadow-[0_18px_38px_rgba(26,31,43,0.16)]">
                    <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#B7DC43] text-[#1A1F2B]">
                      <ScanSearch size={20} aria-hidden="true" />
                    </div>
                    <h3 className="mb-3 text-[18px] font-bold">Where SearchTrust fits</h3>
                    <p className="text-[14px] leading-7 text-[#D2D7DF]">
                      Diagnose local grounding, entity consistency, real-world evidence, and
                      standalone page value before scaling another location-page pattern.
                    </p>
                  </article>

                  <article className="rounded-[24px] border border-[#DDE6C9] bg-[#F1F6E4] p-6">
                    <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#6E8D12] shadow-sm">
                      <ShieldCheck size={20} aria-hidden="true" />
                    </div>
                    <h3 className="mb-3 text-[18px] font-bold text-[#1A1F2B]">
                      What it does not claim
                    </h3>
                    <p className="text-[14px] leading-7 text-[#596275]">
                      SearchTrust does not measure every searcher&apos;s distance, local competitor
                      strength, or guarantee Map Pack placement. Those factors still require
                      separate local performance data.
                    </p>
                  </article>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-5 border-t border-[#DDE3D5] pt-7 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-[580px] text-[12px] leading-5 text-[#7B8495]">
                  Independent analysis of a public community discussion. This is not a SearchTrust
                  customer case, and the original poster has not endorsed SearchTrust.
                </p>
                <a
                  href="https://www.reddit.com/r/localseo/comments/1vbfs0z/how_can_i_rank_page_1_on_serp_but_not_top_3_on/"
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="group inline-flex shrink-0 items-center gap-2 text-[13px] font-extrabold uppercase tracking-[0.12em] text-[#1A1F2B] transition-colors hover:text-[#759813] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A5D020] focus-visible:ring-offset-4"
                >
                  Read the original discussion
                  <ArrowUpRight
                    size={17}
                    className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
