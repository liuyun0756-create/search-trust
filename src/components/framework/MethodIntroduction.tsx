import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  Building2,
  FileSearch,
  ChartNoAxesCombined,
  ClipboardCheck,
} from "lucide-react";
import styles from "./method-guide.module.css";
import ui from "./method-workflow.module.css";

export function MethodIntroduction() {
  return (
    <section
      className={`${styles.section} ${styles.hero} ${ui.hero}`}
      aria-labelledby="method-title"
    >
      <div>
        <p className={styles.eyebrow}>
          Our method / Built for independent local SEOs
        </p>
        <h1 id="method-title">
          Build the proposal around the business.
          <br />
          <span>Build the next plan around the evidence.</span>
        </h1>
        <p className={styles.intro}>
          Before analytics access, connect the prospect’s services, locations,
          website and public search context to identify work worth discussing.
          Once client data is available, revisit those judgments with Search
          Console and GA4. Review the proposed plan, adapt it and explain it to
          your client.
        </p>
        <p className={ui.principle}>
          Business context first. Evidence behind the recommendation. Your
          judgment before delivery.
        </p>
        <div className={styles.actions}>
          <a className={styles.primary} href="#method-scope">
            Explore the working method{" "}
            <ArrowDown size={17} aria-hidden="true" />
          </a>
          <Link className={styles.secondary} href="/sample-report">
            Read the sample reports <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </div>
      <aside
        className={ui.relationship}
        aria-label="One client relationship, two evidence stages"
      >
        <div className={ui.business}>
          <Building2 size={26} aria-hidden="true" />
          <div>
            <span className={styles.eyebrow}>Start with this business</span>
            <strong>Its services. Its market. Its goals.</strong>
          </div>
        </div>
        <div className={ui.journeyStep}>
          <FileSearch size={22} aria-hidden="true" />
          <div>
            <span className={styles.eyebrow}>01 / Win the work</span>
            <h2>Make the first discussion specific.</h2>
            <p>Public observations + confirmed competitor context</p>
            <strong>A first scope and three proposed actions</strong>
          </div>
        </div>
        <p className={ui.connection}>
          <ArrowDown size={17} aria-hidden="true" /> Client confirmation +
          eligible data access
        </p>
        <div className={ui.journeyStep}>
          <ChartNoAxesCombined size={22} aria-hidden="true" />
          <div>
            <span className={styles.eyebrow}>02 / Deliver the work</span>
            <h2>Test the first judgment.</h2>
            <p>Revisit the same question with GSC and GA4.</p>
            <strong>Support, revise or investigate the next action</strong>
          </div>
        </div>
        <div className={ui.humanGate}>
          <ClipboardCheck size={20} aria-hidden="true" />
          <span>You review the plan before it reaches your client.</span>
        </div>
      </aside>
    </section>
  );
}
