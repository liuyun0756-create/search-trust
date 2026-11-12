import {clientKeywordVisibility,type KeywordVisibilityView} from '@/lib/report-capability/keyword-visibility';

export function KeywordVisibilitySection({value,technicalDetails=false}:{value:KeywordVisibilityView;technicalDetails?:boolean}){
 const client=clientKeywordVisibility(value);
 return <section aria-label="Target keyword visibility" className="space-y-4">
  <h2 className="text-xl font-semibold">Target keyword visibility</h2>
  <p className="text-sm">Observed in the saved first-page sample. These observations do not establish an absolute ranking.</p>
  <dl className="grid gap-3 sm:grid-cols-2">
   <div><dt className="font-semibold">Map Pack visibility</dt><dd>{client.localPack.label} {client.localPack.coverage}</dd></div>
   <div><dt className="font-semibold">Organic visibility</dt><dd>{client.organic.label} {client.organic.coverage}</dd></div>
  </dl>
  <div className="overflow-x-auto"><table className="w-full text-left text-sm">
   <caption className="sr-only">Positions and check status for each confirmed target keyword</caption>
   <thead><tr><th scope="col" className="p-3">Target keyword</th><th scope="col" className="p-3">Map Pack</th><th scope="col" className="p-3">Organic first page</th></tr></thead>
   <tbody>{client.rows.map(row=><tr key={row.query} className="border-t border-[#dce6d9]"><th scope="row" className="p-3 font-medium">{row.query}</th><td className="p-3">{row.localPack.text}</td><td className="p-3">{row.organic.text}</td></tr>)}</tbody>
  </table></div>
  {technicalDetails?<aside aria-label="Advisor search details" className="space-y-3 rounded-xl bg-[#f3f7f2] p-4">
   <h3 className="font-semibold">Google Maps reference · advisor only</h3>
   <ul>{value.rows.map(row=><li key={row.query}>{row.query}: {row.maps?.text??'Not checked in this sample.'}</li>)}</ul>
   {value.technical?<details><summary>Inspect keyword sampling conditions</summary><pre className="mt-3 whitespace-pre-wrap break-all text-xs">{JSON.stringify(value.technical,null,2)}</pre></details>:null}
  </aside>:null}
 </section>;
}
