import { ClipboardList, FileCheck2, FileSearch, MapPin, PencilLine } from "lucide-react";

import styles from "./home-workflow.module.css";

const responsibilities = [
  {
    title: "Business context",
    icon: MapPin,
    product: "Website, public business and competitor context for the confirmed scope.",
    professional: "Confirm the business, services, area and relevant competitors.",
  },
  {
    title: "Findings & evidence",
    icon: FileSearch,
    product: "Findings linked to available source records and their limitations.",
    professional: "Check the basis and add what only the client can confirm.",
  },
  {
    title: "Proposed actions",
    icon: ClipboardList,
    product: "Three recommendations with targets, work requirements and review guidance.",
    professional: "Reorder and edit the action plan to fit the engagement.",
  },
  {
    title: "Client delivery",
    icon: FileCheck2,
    product: "SEO and Client reading views, with PDF and sharing options.",
    professional: "Review the client version; save and approve edited plans before delivery.",
  },
];

export function ProductResponsibilities() {
  return (
    <section id="what-searchtrust-does" className={styles.section} aria-labelledby="responsibilities-title">
      <div className={styles.inner}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>THE PRODUCT / THE PROFESSIONAL</p>
            <h2 id="responsibilities-title">A reviewable plan.<br />Not another pile of inputs.</h2>
          </div>
          <p className={styles.introduction}>SearchTrust connects available observations, findings and proposed actions in one Case. You check the evidence and decide what becomes the client plan.</p>
        </header>

        <div className={styles.workbench}>
          <div className={styles.columns} aria-hidden="true">
            <span>The work</span>
            <strong>SearchTrust prepares</strong>
            <strong>You decide</strong>
          </div>
          <ol className={styles.responsibilities}>
            {responsibilities.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title}>
                  <h3><Icon size={20} strokeWidth={1.6} aria-hidden="true" />{item.title}</h3>
                  <dl>
                    <div className={styles.product}><dt>SearchTrust prepares</dt><dd>{item.product}</dd></div>
                    <div><dt>You decide</dt><dd>{item.professional}</dd></div>
                  </dl>
                </li>
              );
            })}
          </ol>
          <p className={styles.boundary}><PencilLine size={17} aria-hidden="true" /><span><strong>Edit the plan, not the source observations.</strong> A changed scope needs its own supporting evidence.</span></p>
        </div>
      </div>
    </section>
  );
}
