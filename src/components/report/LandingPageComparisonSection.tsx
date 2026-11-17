import {clientLandingComparison,type LandingComparisonView} from '@/lib/report-capability/landing-page-comparison';
export function LandingPageComparisonSection({value,technicalDetails=false}:{value:LandingComparisonView;technicalDetails?:boolean}){
 const view=clientLandingComparison(value);
 return <section aria-label="Landing page comparison" className="space-y-4">
  <h2 className="text-xl font-semibold">Landing page comparison</h2><p>{view.cityLimit}</p>
  <p>Saved page samples show observed content, not full-site coverage or verified credentials. Project budgets and discounts are separate from service prices.</p>
  <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Customer and competitor landing page samples</caption>
   <thead><tr><th scope="col" className="p-3">Element</th>{view.rows.map((r,i)=><th scope="col" key={i} className="p-3">{r.name}</th>)}</tr></thead>
   <tbody>{view.rows[0].metrics.map((m,i)=><tr key={m.key} className="border-t border-[#dce6d9]"><th scope="row" className="p-3">{m.label}</th>{view.rows.map((r,j)=><td key={j} className="p-3">{r.metrics[i].text}</td>)}</tr>)}</tbody>
  </table></div>
  {view.rows.map((r,i)=><div key={i}><p>{r.name}: {r.scope}</p><p>{r.pageTypes.map(p=>`${p.label}: ${p.count}`).join('; ')}</p><ul>{r.sources.map(url=><li key={url}><a href={url} rel="noreferrer" target="_blank">{url}</a></li>)}</ul></div>)}
  <ul>{view.comparisons.map(c=><li key={c.metric}>{c.label} — Inference: {c.text}</li>)}</ul>
  {technicalDetails&&value.technical?<details><summary>Inspect landing page comparison sources</summary><pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(value.technical,null,2)}</pre></details>:null}
 </section>;
}
