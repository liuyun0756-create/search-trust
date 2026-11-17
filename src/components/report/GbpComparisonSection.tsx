import {GBP_LABELS,clientGbpComparison,type GbpComparisonView} from '@/lib/report-capability/gbp-comparison';
export function GbpComparisonSection({value,technicalDetails=false}:{value:GbpComparisonView;technicalDetails?:boolean}){
 const view=clientGbpComparison(value);
 return <section aria-label="Google Business Profile comparison" className="space-y-4">
  <h2 className="text-xl font-semibold">Google Business Profile comparison</h2>
  <p>Saved profile observations and bounded review samples. Sample counts do not represent all reviews.</p>
  <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Customer and confirmed competitor profiles</caption>
   <thead><tr><th scope="col" className="p-3">Metric</th>{view.rows.map((r,i)=><th scope="col" key={i} className="p-3">{r.name}{r.subject==='customer'?' · Customer':''}</th>)}</tr></thead>
   <tbody>{view.rows[0].metrics.map((metric,i)=><tr key={metric.key} className="border-t border-[#dce6d9]"><th scope="row" className="p-3">{metric.label}</th>{view.rows.map((r,j)=><td key={j} className="p-3">{r.metrics[i].text}{r.metrics[i].sampledAt?<span className="block text-xs">Sampled {r.metrics[i].sampledAt}</span>:null}</td>)}</tr>)}</tbody>
  </table></div>
  <ul className="space-y-1 text-sm">{view.differences.map(d=><li key={d.metric}>{GBP_LABELS[d.metric]}: {d.text}</li>)}</ul>
  {technicalDetails&&value.technical?<details><summary>Inspect profile comparison sources</summary><pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(value.technical,null,2)}</pre></details>:null}
 </section>;
}
