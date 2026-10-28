import Link from "next/link";
import { ArrowRight, FileCheck2, FileSearch, ShieldCheck } from "lucide-react";
import { pricingReports } from "./pricing-content";
import styles from "./pricing-v22.module.css";

export function WhatOneCreditStarts() {
  return <section id="pricing-deliverables" className={styles.section} aria-labelledby="deliverables-title">
    <div className={styles.sectionInner}>
      <header className={styles.sectionHeading}>
        <p className={styles.eyebrow}>What one credit delivers</p>
        <h2 id="deliverables-title">See the work behind one credit.</h2>
        <p>A report for the prospect conversation, or a plan for the client work. Here is what the material looks like.</p>
        <span className={styles.sampleNote}>Sample report · {pricingReports[0].business}</span>
      </header>
      <div className={styles.reportGrid}>{pricingReports.map((report, index) => <article key={report.id} className={styles.reportCard}>
        <header className={styles.reportHeader}>
          <div className={styles.reportType}>{index === 0 ? <FileSearch aria-hidden="true" /> : <FileCheck2 aria-hidden="true" />}<span>{report.name}</span><b>1 credit</b></div>
          <h3>{report.title}</h3>
        </header>
        <div className={styles.reportPaper}>
          <div className={styles.reportMeta}><span>{report.business}</span><span>{report.page}</span></div>
          <dl>{report.sections.map((section, i) => <div key={section.label} className={styles.reportSection}><dt><span aria-hidden="true">0{i + 1}</span>{section.label}</dt><dd>{section.text}</dd></div>)}</dl>
          <p className={styles.reportLimit}><ShieldCheck aria-hidden="true" />{report.limit}</p>
        </div>
        <footer className={styles.reportFooter}><p>{report.use}</p><Link className={styles.textLink} href={report.link.href}>{report.link.label}<ArrowRight aria-hidden="true" /></Link>{report.condition && <small>{report.condition}</small>}</footer>
      </article>)}</div>
    </div>
  </section>;
}
