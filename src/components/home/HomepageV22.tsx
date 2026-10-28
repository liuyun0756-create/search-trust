import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  FileSearch,
  Search,
  Sparkles,
} from "lucide-react";

import { ReportOutcomePreview } from "./ReportOutcomePreview";
import { ReasoningDecisionTabs } from "./ReasoningDecisionTabs";
import { ClientConversation } from "./ClientConversation";
import { ProductResponsibilities } from "./ProductResponsibilities";
import styles from "./homepage-hero.module.css";

function CaseDecisionStage() {
  return (
    <div className={styles.caseStage} aria-label="Illustrative example of one case across two report stages">
      <div className={styles.ambientGlow} aria-hidden="true" />
      <div className={styles.caseCanvas}>
        <div className={styles.canvasHeader}>
          <span className={styles.caseMarker} aria-hidden="true"><FileSearch size={19} strokeWidth={1.8} /></span>
          <div>
            <p className={styles.canvasEyebrow}>One fictional case · two decisions</p>
            <p className={styles.canvasContext}>Core air-conditioning repair service</p>
          </div>
        </div>

        <div className={styles.paperStack}>
          <article className={`${styles.paper} ${styles.prospectPaper}`}>
            <div className={styles.paperMeta}>
              <span>01 / Before client access</span>
              <span>Prospect report</span>
            </div>
            <h2 className={styles.paperQuestion}>Does this service need its own page?</h2>
            <p className={styles.paperEvidence}>Public pages leave the service explanation scattered. An existing page still needs to be checked.</p>
            <p className={styles.paperOutput}><strong>You get</strong> a specific finding and three proposed first actions.</p>
          </article>

          <div className={styles.evidenceBridge}>
            <span className={styles.bridgeDot} aria-hidden="true" />
            Client confirms a page · search evidence is added
          </div>

          <article className={`${styles.paper} ${styles.verifiedPaper}`}>
            <div className={styles.paperMeta}>
              <span>02 / After client access</span>
              <span>Verified plan</span>
            </div>
            <h2 className={styles.paperDecision}>Improve the page that already exists.</h2>
            <p className={styles.verifiedEvidence}>Relevant searches already bring it exposure and clicks. The first judgment changes.</p>
            <p className={styles.verifiedOutput}><strong>You get</strong> prioritized work, completion checks and a way to review it.</p>
          </article>
        </div>

        <p className={styles.exampleNote}>Illustrative method example · not a real client result</p>
      </div>
    </div>
  );
}


export function HomepageV22() {
  return (
    <div className={`${styles.homepageSurface} overflow-clip text-[#1d2a22]`}>
      <section className={`${styles.homeHeroSection} relative isolate px-4 pb-14 pt-16 sm:px-6 sm:pb-20 sm:pt-24 lg:px-8`}>
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.06fr_0.94fr] lg:gap-14">
          <div className={styles.heroCopy}>
            <p className={styles.heroEyebrow}>For local SEO consultants and small agencies</p>
            <h1 className={styles.heroTitle}>
              <span className={styles.heroTitleLine}>A clearer first proposal.</span>
              <span className={styles.heroTitleLine}>A better-informed <span className={styles.heroAccent}>next move.</span></span>
            </h1>
            <p className={styles.heroDescription}>
              Before client access, turn checked public evidence into specific findings and three proposed actions. After access, test the same judgment with Search Console and GA4, then review a prioritized work plan before it reaches the client.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="#choose-work" className="group inline-flex min-h-13 items-center justify-center gap-2 rounded-lg bg-[#26432e] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#365d40] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#26432e]">
                Choose your work <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </Link>
              <Link href="/sample-report" className="inline-flex min-h-13 items-center justify-center rounded-lg border border-[#dfe7dc] bg-white px-6 py-3.5 text-sm font-semibold text-[#42614a] transition-colors hover:bg-[#f2f7f1]">
                See the two sample reports
              </Link>
            </div>
            <p className={styles.heroCredits}><Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> 5 permanent credits when you join <span aria-hidden="true">·</span> No subscription</p>
          </div>
          <CaseDecisionStage />
        </div>
      </section>

      <section id="choose-work" aria-labelledby="choose-work-title" className={styles.workEntrySection}>
        <div className={styles.workEntryInner}>
          <div className={styles.workEntryIntro}>
            <p className={styles.workEntryEyebrow}>YOUR WORK / TWO STARTING POINTS</p>
            <h2 id="choose-work-title">Choose your next move.</h2>
            <p>Choose the stage you are in. We’ll take you straight to the right Case workflow.</p>
            <p className={styles.workEntryAssurance}>Choose freely · no analysis or credit is used here</p>
          </div>
          <div className={styles.workEntryGrid}>
            <Link href="/cases/new" className={`${styles.workEntryPath} ${styles.workEntryProspect}`} aria-label="Start a Prospect Case">
              <span className={styles.workEntryPathMeta}><span>01 / BEFORE CLIENT ACCESS</span><Search size={18} strokeWidth={1.8} aria-hidden="true" /></span>
              <div className={styles.workEntryPathBody}>
                <h3>Win the work.</h3>
                <p>Turn this business’s public evidence into a proposal you can stand behind.</p>
              </div>
              <span className={styles.workEntryPathBottom}>
                <span className={styles.workEntryDeliverable}>Specific findings <span aria-hidden="true">·</span> three first actions</span>
                <span className={styles.workEntryAction}>Start a Prospect Case <span className={styles.workEntryArrow}><ArrowRight size={18} aria-hidden="true" /></span></span>
              </span>
            </Link>
            <Link href="/cases/service" className={`${styles.workEntryPath} ${styles.workEntryService}`} aria-label="Choose a client Case">
              <span className={styles.workEntryPathMeta}><span>02 / AFTER CLIENT ACCESS</span><BarChart3 size={18} strokeWidth={1.8} aria-hidden="true" /></span>
              <div className={styles.workEntryPathBody}>
                <h3>Move the work forward.</h3>
                <p>Open an existing Case, add client data and decide the next priority.</p>
              </div>
              <span className={styles.workEntryPathBottom}>
                <span className={styles.workEntryDeliverable}>Client data <span aria-hidden="true">·</span> prioritized action plan</span>
                <span className={styles.workEntryAction}>Choose a client Case <span className={styles.workEntryArrow}><ArrowRight size={18} aria-hidden="true" /></span></span>
              </span>
            </Link>
            <p className={styles.workEntryFootnote}>No Prospect Case yet? Direct service setup is not available yet.</p>
          </div>
        </div>
      </section>

      <ClientConversation />

      <ProductResponsibilities />

      <ReasoningDecisionTabs />

      <ReportOutcomePreview />

      <section className="px-4 pb-24 pt-8 sm:px-6 lg:px-8 lg:pb-32 lg:pt-12">
        <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[2.2rem] border border-[#d7ddce] bg-white shadow-[0_24px_80px_rgba(24,32,24,0.08)] lg:grid-cols-[1.05fr_0.95fr]">
          <div className="p-8 sm:p-12 lg:p-16">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#718d18]">Simple permanent credits</p>
            <h2 className="mt-4 max-w-xl text-3xl font-semibold leading-tight tracking-[-0.045em] sm:text-4xl">Use a credit when the work creates value.</h2>
            <div className="mt-6 max-w-xl space-y-3 text-base leading-7 text-[#667064]">
              <p><strong className="text-[#26432e]">Free:</strong> enter a website and confirm the business.</p>
              <p><strong className="text-[#26432e]">1 credit:</strong> start competitor discovery and the full Prospect analysis.</p>
              <p><strong className="text-[#26432e]">1 credit:</strong> generate or regenerate a Verified Action Plan.</p>
            </div>
            <div className="mt-9 flex flex-wrap gap-3 text-sm font-bold">
              {["5 credits at signup", "No expiration", "No subscription", "Resume the same workflow free", "Technical failure returns 1 credit"].map((item) => <span key={item} className="rounded-full border border-[#d7ddce] bg-[#f6f8ef] px-4 py-2">{item}</span>)}
            </div>
          </div>
          <div className="flex flex-col justify-between bg-[#eaf3e8] p-8 text-[#26432e] sm:p-12 lg:p-16">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em]">Additional credits</p>
              <div className="mt-6 flex items-end gap-3"><span className="text-6xl font-semibold leading-none tracking-[-0.06em]">$19</span><span className="pb-2 text-sm font-black">USD / credit</span></div>
              <p className="mt-6 max-w-sm font-semibold leading-7 text-[#34410e]">One account balance. Use it across Prospect and Verified workflows on any of your Cases.</p>
            </div>
            <Link href="/pricing" className="group mt-10 inline-flex min-h-13 items-center justify-center gap-2 rounded-lg bg-[#26432e] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#365d40]">See pricing details <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></Link>
          </div>
        </div>
      </section>

    </div>
  );
}
