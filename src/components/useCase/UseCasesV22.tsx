import Link from "next/link";
import { ArrowDown, ArrowRight, FileSearch, MessageCircleQuestion } from "lucide-react";
import { clientWorkExample } from "./client-work-example";
import { ReadyToUseWork } from "./ReadyToUseWork";
import { ReportOutcomePreviews } from "./ReportOutcomePreviews";
import { ScenarioWorkbench } from "./ScenarioWorkbench";
import s from "./practice-workbench.module.css";

export function UseCasesV22() {
  return (
    <div className={s.page}>
      <section className={s.hero} aria-labelledby="practice-title">
        <div className={s.heroStage}>
          <div className={s.heroMotifs} aria-hidden="true">
            <div className={`${s.heroMotif} ${s.questionMotif}`}>
              <MessageCircleQuestion size={27} />
              <span>01</span>
              <small>CLIENT QUESTION</small>
              <strong>Where do we begin?</strong>
            </div>
            <div className={`${s.heroMotif} ${s.evidenceMotif}`}>
              <FileSearch size={27} />
              <span>02</span>
              <small>REPORT MATERIAL</small>
              <strong>Evidence, then a decision.</strong>
            </div>
          </div>
          <div className={s.heroCopy} data-testid="practice-hero-copy">
            <p className={s.eyebrow}>
              Client scenarios · for independent local SEOs
            </p>
            <h1 id="practice-title">
              From the first pitch to the next client review.
            </h1>
            <p className={s.heroIntro}>
              Turn evidence into a focused prospect conversation, a workable
              client plan, and a clearer next step. See where SearchTrust fits
              into the work you already do.
            </p>
            <div className={s.heroLinks}>
              <a className={s.primary} href="#practice-scenarios">
                Find your situation <ArrowDown size={17} aria-hidden="true" />
              </a>
              <Link className={s.secondary} href="/sample-report">
                Read the sample reports{" "}
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>
          <ReportOutcomePreviews example={clientWorkExample} />
        </div>
      </section>

      <ScenarioWorkbench />

      <ReadyToUseWork example={clientWorkExample} />

      <section className={s.nextStep} aria-labelledby="next-step-title">
        <div>
          <p className={s.eyebrow}>A client to begin with</p>
          <h2 id="next-step-title">Take the next step from the right place.</h2>
          <p>
            Browsing these situations is free. Analysis credits are used only at
            the stages explained on the{" "}
            <Link href="/pricing">Pricing page</Link>.
          </p>
        </div>
        <div className={s.nextChoices}>
          <Link href="/cases/new">
            <span>Preparing for a prospect?</span>
            <strong>Start a Prospect Case</strong>
            <ArrowRight size={19} aria-hidden="true" />
          </Link>
          <Link href="/cases/service">
            <span>Working with an existing client?</span>
            <strong>Continue a client Case</strong>
            <ArrowRight size={19} aria-hidden="true" />
          </Link>
          <p>
            Service work starts from a completed Prospect Case, then continues
            with client confirmation and eligible data access.
          </p>
        </div>
      </section>
    </div>
  );
}
