"use client";

import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Building2,
  Files,
  MapPinned,
  MessageSquareQuote,
  ScanSearch,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

type Scenario = {
  number: string;
  category: string;
  title: string;
  summary: string;
  problemTitle: string;
  problem: string;
  discussionPoints: string[];
  fit: string;
  boundary: string;
  sourceUrl: string;
  icon: LucideIcon;
  frameClass: string;
  dividerClass: string;
  badgeClass: string;
  iconClass: string;
  bulletClass: string;
  glow: string;
};

const scenarios: Scenario[] = [
  {
    number: "01",
    category: "Search visibility",
    title: "Page 1 organically. Missing from the Map Pack. Why?",
    summary:
      "A local business owner described a page that already appeared on the first organic results page, while its local Map Pack visibility remained weak and inconsistent. They were also considering more hyperlocal pages as the next move.",
    problemTitle: "Organic and local visibility told different stories",
    problem:
      "Adding more pages would not, by itself, explain whether proximity, GBP strength, entity consistency, or weak local evidence was holding the result back.",
    discussionPoints: [
      "Search proximity and the location of the person searching",
      "GBP prominence, category fit, reviews, and local competition",
      "Whether the page and business entity send consistent local signals",
    ],
    fit:
      "Diagnose local grounding, entity consistency, real-world evidence, and standalone page value before scaling another location-page pattern.",
    boundary:
      "SearchTrust does not measure every searcher's distance, local competitor strength, or guarantee Map Pack placement. Those factors still require separate local performance data.",
    sourceUrl:
      "https://www.reddit.com/r/localseo/comments/1vbfs0z/how_can_i_rank_page_1_on_serp_but_not_top_3_on/",
    icon: MapPinned,
    frameClass: "border-[#DDE6C9] bg-[#F7F9F2]",
    dividerClass: "border-[#DDE6C9]",
    badgeClass: "border-[#CAD99D] text-[#647A20]",
    iconClass: "bg-[#EDF5D4] text-[#6E8D12]",
    bulletClass: "border-[#B7DC43]",
    glow:
      "radial-gradient(circle at 13% 16%, rgba(165,208,32,0.18), transparent 28%), radial-gradient(circle at 88% 8%, rgba(26,31,43,0.08), transparent 24%)",
  },
  {
    number: "02",
    category: "Multi-location alignment",
    title: "One brand. Multiple locations. Is each GBP connected to the right page?",
    summary:
      "An auditor found a multi-location business with dedicated location pages on its main website, while some GBP website fields pointed to separate local domains. Some forwarded to the intended page and others did not.",
    problemTitle: "Several plausible URLs represented the same locations",
    problem:
      "The setup made it difficult to confirm that every public business profile consistently led customers and search systems to the page representing that specific location.",
    discussionPoints: [
      "Which website URL each location's GBP should expose",
      "Whether secondary domains forward consistently to the main website",
      "Whether every profile connects to its matching location page",
    ],
    fit:
      "Compare a target location page with the discovered GBP record and surface inconsistencies across business name, address, phone, website, and local identity.",
    boundary:
      "SearchTrust does not calculate link equity, prescribe a redirect strategy, or guarantee that changing a GBP website URL will improve local visibility.",
    sourceUrl:
      "https://www.reddit.com/r/localseo/comments/1nueqvn/linking_to_a_location_landing_page_vs_a_location/",
    icon: Building2,
    frameClass: "border-[#DCE4EC] bg-[#F6F8FA]",
    dividerClass: "border-[#DCE4EC]",
    badgeClass: "border-[#C6D4E1] text-[#50677C]",
    iconClass: "bg-[#E7EEF5] text-[#50677C]",
    bulletClass: "border-[#8FA9C0]",
    glow:
      "radial-gradient(circle at 12% 14%, rgba(112,143,169,0.16), transparent 28%), radial-gradient(circle at 90% 8%, rgba(26,31,43,0.07), transparent 25%)",
  },
  {
    number: "03",
    category: "Scaled page quality",
    title: "Twenty city pages. One template. Are they actually local?",
    summary:
      "A reviewer opened a roofing website's city pages and found the same service copy, claims, and layout repeated across locations. The most visible change from page to page was the city name.",
    problemTitle: "Page coverage increased without distinct local evidence",
    problem:
      "The pages claimed broad local coverage but offered little location-specific work, imagery, customer evidence, service context, or reason for each page to exist on its own.",
    discussionPoints: [
      "Whether changing the city name creates meaningful page value",
      "Which local projects, photos, reviews, and service details are verifiable",
      "When fewer strong pages are more useful than many generic ones",
    ],
    fit:
      "Review one priority city page for specificity, real-world connection, accountable evidence, and standalone value before an agency scales the same pattern.",
    boundary:
      "SearchTrust does not declare a duplicate-content penalty, estimate traffic loss, or prove that consolidating pages will improve rankings.",
    sourceUrl:
      "https://www.reddit.com/r/localseo/comments/1thmhmi/stop_copypasting_city_pages_and_calling_it_local/",
    icon: Files,
    frameClass: "border-[#E8E0CF] bg-[#FAF8F3]",
    dividerClass: "border-[#E8E0CF]",
    badgeClass: "border-[#DDD0B5] text-[#7C653A]",
    iconClass: "bg-[#F1E9D9] text-[#7C653A]",
    bulletClass: "border-[#C7A96B]",
    glow:
      "radial-gradient(circle at 14% 15%, rgba(199,169,107,0.16), transparent 28%), radial-gradient(circle at 88% 9%, rgba(26,31,43,0.07), transparent 24%)",
  },
];

function ScenarioCard({ scenario, index }: { scenario: Scenario; index: number }) {
  const ProblemIcon = scenario.icon;

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.06, 0.12) }}
      className={`relative overflow-hidden rounded-[36px] border shadow-[0_26px_70px_rgba(26,31,43,0.08)] ${scenario.frameClass}`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        aria-hidden="true"
        style={{ backgroundImage: scenario.glow }}
      />

      <div className="relative grid lg:grid-cols-[0.92fr_1.08fr]">
        <div
          className={`flex flex-col justify-between border-b p-8 sm:p-10 lg:border-b-0 lg:border-r lg:p-12 ${scenario.dividerClass}`}
        >
          <div>
            <div
              className={`mb-8 inline-flex items-center gap-2 rounded-full border bg-white/80 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.16em] ${scenario.badgeClass}`}
            >
              <MessageSquareQuote size={15} aria-hidden="true" />
              Public local SEO discussion
            </div>

            <p className="mb-4 text-[12px] font-black uppercase tracking-[0.18em] text-[#8A95A7]">
              Community scenario {scenario.number} · {scenario.category}
            </p>
            <h3 className="max-w-[620px] text-[34px] font-bold leading-[1.08] tracking-[-0.035em] text-[#1A1F2B] sm:text-[42px] lg:text-[46px]">
              {scenario.title}
            </h3>

            <p className="mt-7 max-w-[600px] text-[16px] font-medium leading-[1.75] text-[#596275]">
              {scenario.summary}
            </p>
          </div>

          <div className="mt-10 rounded-[24px] border border-white/80 bg-white/75 p-6 backdrop-blur-sm">
            <div className="mb-3 flex items-center gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${scenario.iconClass}`}
              >
                <ProblemIcon size={19} aria-hidden="true" />
              </div>
              <h4 className="text-[17px] font-bold text-[#1A1F2B]">
                {scenario.problemTitle}
              </h4>
            </div>
            <p className="text-[14px] leading-7 text-[#626C7E]">{scenario.problem}</p>
          </div>
        </div>

        <div className="flex flex-col p-8 sm:p-10 lg:p-12">
          <div className="grid gap-5">
            <div className="rounded-[24px] border border-black/[0.07] bg-white p-6 shadow-[0_8px_30px_rgba(26,31,43,0.04)]">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3F4F6] text-[#505B6D]">
                  <MessageSquareQuote size={18} aria-hidden="true" />
                </div>
                <h4 className="text-[18px] font-bold text-[#1A1F2B]">
                  What the community debated
                </h4>
              </div>
              <ul className="grid gap-3 text-[14px] leading-6 text-[#5F697B] sm:grid-cols-3">
                {scenario.discussionPoints.map((point) => (
                  <li
                    key={point}
                    className={`relative border-l-2 pl-4 ${scenario.bulletClass}`}
                  >
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="h-full rounded-[24px] border border-black/[0.07] bg-white/90 p-5 shadow-[0_10px_28px_rgba(26,31,43,0.05)]">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#B7DC43] text-[#1A1F2B]">
                  <ScanSearch size={20} aria-hidden="true" />
                </div>
                <h4 className="mb-2 text-[18px] font-bold text-[#1A1F2B]">
                  Where SearchTrust fits
                </h4>
                <p className="text-[14px] leading-7 text-[#596275]">{scenario.fit}</p>
              </div>

              <div className="h-full rounded-[24px] border border-black/[0.07] bg-white/90 p-5 shadow-[0_10px_28px_rgba(26,31,43,0.05)]">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#EDF5D4] text-[#6E8D12]">
                  <ShieldCheck size={20} aria-hidden="true" />
                </div>
                <h4 className="mb-2 text-[18px] font-bold text-[#1A1F2B]">
                  What it does not claim
                </h4>
                <p className="text-[14px] leading-7 text-[#596275]">
                  {scenario.boundary}
                </p>
              </div>
            </div>
          </div>

          <div
            className={`mt-7 flex items-center justify-between gap-4 border-t pt-3 lg:mt-auto lg:pt-5 ${scenario.dividerClass}`}
          >
            <p className="text-[10px] leading-4 text-[#929BAA] sm:text-[11px]">
              Independent commentary; not a customer case.
            </p>
            <a
              href={scenario.sourceUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              aria-label="Open the original public discussion"
              className="group inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/75 px-3 text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#1A1F2B] transition-[color,border-color,background-color] hover:border-[#B7DC43] hover:bg-white hover:text-[#759813] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A5D020] focus-visible:ring-offset-3"
            >
              Source
              <ArrowUpRight
                size={14}
                className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </a>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

export function CommunityScenario() {
  return (
    <section
      id="community-scenario"
      className="scroll-mt-28 overflow-hidden bg-white py-20"
    >
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.45 }}
          className="mb-10 max-w-3xl"
        >
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#759813]">
            Public diagnostic scenarios
          </p>
          <h2 className="mt-3 text-[34px] font-bold leading-tight tracking-[-0.035em] text-[#1A1F2B] sm:text-[42px]">
            Real questions agencies face before recommending more work
          </h2>
          <p className="mt-5 max-w-2xl text-[15px] font-medium leading-7 text-[#687385]">
            These are independent analyses of public local SEO discussions. They show where a
            structured trust audit can support a decision without presenting community stories as
            SearchTrust customer results.
          </p>
        </motion.div>

        <div className="space-y-10">
          {scenarios.map((scenario, index) => (
            <ScenarioCard key={scenario.number} scenario={scenario} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
