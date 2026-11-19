import type { LocalEntityCoverageView } from "@/lib/report-capability/local-entity-coverage";

export function LocalEntityCoverageSection({value, technicalDetails}: {
  value: LocalEntityCoverageView;
  technicalDetails: boolean;
}) {
  return <section aria-label="Target city coverage" className="space-y-2">
    <h2 className="text-xl font-semibold">Target city coverage</h2>
    <p>{[value.city, value.status].filter(Boolean).join(" · ")}</p>
    <p>{value.limit}</p>
    <p>{value.scope}</p>
    {value.observations.length ? <ul>{value.observations.map(row =>
      <li key={row.position} className="break-words">{row.position}: {row.quote}</li>
    )}</ul> : null}
    {technicalDetails && value.technical ? <details>
      <summary>Sample details</summary>
      <p>{value.technical.reason}</p>
      {value.technical.archiveHeadingsOnly ? <p>Title and main heading matches were found only on archive pages.</p> : null}
      <ul>{value.technical.pages.map(row => <li key={row.url + row.position} className="break-all">
        {row.url} · {row.position}{row.archive ? " · Archive page" : ""} · {row.sampledAt}
      </li>)}</ul>
    </details> : null}
  </section>;
}
