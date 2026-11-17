import type {PossibleReasonsView} from '@/lib/report-capability/possible-reasons';
export function PossibleReasonsSection({value,technicalDetails=false}:{value:PossibleReasonsView;technicalDetails?:boolean}){
 return <section aria-label="Possible contributing factors" className="space-y-3"><h2>Possible contributing factors</h2>
  {value.items.length?value.items.map((item,i)=><p key={i}>{item.text}</p>):<p>Not assessed</p>}
  {technicalDetails&&value.technical?<details><summary>Inspect possible reason sources</summary><pre>{JSON.stringify(value.technical,null,2)}</pre></details>:null}
 </section>;
}
