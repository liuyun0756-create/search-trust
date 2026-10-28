"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import {
  formatBaseline,
  type ClientWorkExample,
} from "./client-work-example";
import s from "./client-work-preview.module.css";

type Audience = "client" | "seo";
const audiences: Audience[] = ["client", "seo"];

export function ClientDeliveryPreview({
  example,
}: {
  example: ClientWorkExample;
}) {
  const [audience, setAudience] = useState<Audience>("client");
  const tabs = useRef<Record<Audience, HTMLButtonElement | null>>({
    client: null,
    seo: null,
  });

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    let next: Audience | null = null;
    if (event.key === "Home" || event.key === "ArrowLeft") next = "client";
    if (event.key === "End" || event.key === "ArrowRight") next = "seo";
    if (!next) return;
    event.preventDefault();
    setAudience(next);
    tabs.current[next]?.focus();
  }

  return (
    <div className={s.deliveryPaper}>
      <div className={s.deliveryToolbar}>
        <p>
          <span>Client delivery</span> · {example.business.name} · {example.page.path}
        </p>
        <div
          className={s.audienceTabs}
          role="tablist"
          aria-label="Report delivery audience"
        >
          {audiences.map((item) => (
            <button
              key={item}
              ref={(node) => {
                tabs.current[item] = node;
              }}
              type="button"
              role="tab"
              id={`delivery-tab-${item}`}
              aria-controls={`delivery-panel-${item}`}
              aria-selected={audience === item}
              tabIndex={audience === item ? 0 : -1}
              onClick={() => setAudience(item)}
              onKeyDown={onTabKey}
            >
              {item === "client" ? "Client view" : "SEO view"}
            </button>
          ))}
        </div>
      </div>
      <div
        id="delivery-panel-client"
        className={s.deliveryBody}
        role="tabpanel"
        aria-labelledby="delivery-tab-client"
        hidden={audience !== "client"}
      >
        <p className={s.documentOverline}>
          {example.business.name} · AC repair page
        </p>
        <h4>{example.deliveryCopy.client.title}</h4>
        <p className={s.documentLead}>{example.deliveryCopy.client.intro}</p>
        <div className={s.deliverySections}>
          <section>
            <h5>What we found</h5>
            <p>{example.deliveryCopy.client.found}</p>
          </section>
          <section>
            <h5>The proposed work</h5>
            <ol>
              {example.deliveryCopy.client.proposedWork.map((work) => (
                <li key={work}>{work}</li>
              ))}
            </ol>
          </section>
          <section>
            <h5>Why start here</h5>
            <p>{example.deliveryCopy.client.why}</p>
          </section>
          <section>
            <h5>How we will review it</h5>
            <p>{example.deliveryCopy.client.review}</p>
          </section>
        </div>
        <p className={s.documentStatus}>
          {example.implementationStatus.replace(/^Proposed/, "Proposed work")}
        </p>
      </div>
      <div
        id="delivery-panel-seo"
        className={s.deliveryBody}
        role="tabpanel"
        aria-labelledby="delivery-tab-seo"
        hidden={audience !== "seo"}
      >
        <p className={s.documentOverline}>
          {example.business.name} · Professional reading view
        </p>
        <h4>Evidence, decision and delivery checks.</h4>
        <dl className={s.seoSummary}>
          <div>
            <dt>Decision</dt>
            <dd>{example.deliveryCopy.seo.decision}</dd>
          </div>
          <div>
            <dt>Evidence</dt>
            <dd>{example.deliveryCopy.seo.evidence}</dd>
          </div>
          <div>
            <dt>Baseline</dt>
            <dd>{formatBaseline(example)}</dd>
          </div>
          <div>
            <dt>Execution</dt>
            <dd>{example.deliveryCopy.seo.execution}</dd>
          </div>
          <div>
            <dt>Acceptance</dt>
            <dd>{example.deliveryCopy.seo.acceptance}</dd>
          </div>
          <div>
            <dt>Review limits</dt>
            <dd>{example.deliveryCopy.seo.reviewLimits}</dd>
          </div>
        </dl>
        <p className={s.documentStatus}>{example.implementationStatus}</p>
      </div>
    </div>
  );
}
