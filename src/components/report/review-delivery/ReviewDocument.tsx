import type { ReviewClientDocument } from "@/lib/review-reports/projection";
export function ReviewDocument({document:d}:{document:ReviewClientDocument}){
  return <article className="space-y-9 rounded-2xl border border-[#dce6d9] bg-white p-5 text-[#203d32] sm:p-9">
    <header className="border-b border-[#dce6d9] pb-7"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#63865c]">Verified Action Plan · Review</p>
      <h1 className="mt-3 break-words text-3xl font-semibold tracking-tight">{d.title}</h1><p className="mt-3 text-sm text-[#617469]">{d.service} · {d.market}</p>
      <p className="mt-2 break-all text-xs text-[#617469]">{d.siteUrl} · Review prepared {d.evaluatedAt}</p><p className="mt-6 whitespace-pre-wrap break-words leading-7">{d.summary}</p></header>
    <section><h2 className="text-lg font-semibold">This period: work and observations</h2>
      {!d.observations.length?<p className="mt-3 leading-7">No implementation actions were available for review. The diagnosis and limits below remain part of this report.</p>:null}
      {d.observations.map((o,i)=><section key={i} className="mt-4 rounded-xl border border-[#dce6d9] p-5"><h3 className="font-semibold">{String(i+1).padStart(2,"0")} / {o.title}</h3><p className="mt-2 break-all text-sm text-[#617469]">{o.target}</p>
        <ul className="mt-4 space-y-3 text-sm leading-6">{o.lines.map((line,j)=><li key={j} className="break-words border-l-2 border-[#dce6d9] pl-3">{line}</li>)}</ul></section>)}</section>
    <section><h2 className="text-lg font-semibold">Next work to agree</h2>{!d.actions.length?<p className="mt-3 leading-7">No next action is proposed. Review the observations and open checks before agreeing further work.</p>:null}
      {d.actions.map((a,i)=><section key={a.id} className="mt-4 rounded-xl bg-[#f2f7ef] p-5"><h3 className="font-semibold">{String(i+1).padStart(2,"0")} / {a.title}</h3><p className="mt-2 break-all text-sm">{a.target}</p>
        <ol className="mt-4 list-inside list-decimal space-y-2 leading-7">{a.steps.map((s,j)=><li key={j} className="whitespace-pre-wrap break-words">{s}</li>)}</ol>
        <p className="mt-5 text-sm font-semibold">Completion checks</p><ul className="mt-2 list-inside list-disc space-y-2 text-sm">{a.completion.map((s,j)=><li key={j}>{s}</li>)}</ul><p className="mt-4 text-sm leading-6">{a.review}</p>
        {a.materials.map((m,j)=><aside key={j} className="mt-4 rounded-lg border border-[#dce6d9] p-4"><h4 className="font-semibold">{m.title}</h4><p className="mt-2 break-all text-xs">Original material target: {m.target} · {m.readiness.replaceAll("_"," ")}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{m.body}</p>{m.confirmation_items.map((s,k)=><p key={k} className="mt-2 text-xs">Confirm: {s}</p>)}</aside>)}</section>)}</section>
    <section><h2 className="text-lg font-semibold">Original diagnosis · retained for context</h2><p className="mt-2 text-xs text-[#617469]">These observations come from the earlier report and have not been rechecked here.</p>
      {d.prior.map((p,i)=><section key={i} className="mt-4 border-l-2 border-[#9fba8a] pl-4 text-sm leading-6"><h3 className="break-all font-semibold">{p.title}</h3><p className="mt-2">{p.summary}</p>{p.lines.map((l,j)=><p key={j} className="mt-2 break-words text-[#617469]">{l}</p>)}</section>)}</section>
    {d.clientNote?<aside className="rounded-xl bg-[#f2f7ef] p-5"><h2 className="font-semibold">Note from your SEO</h2><p className="mt-3 whitespace-pre-wrap break-words leading-7">{d.clientNote}</p></aside>:null}
    <footer className="border-t border-[#dce6d9] pt-6"><h2 className="font-semibold">Scope and limits</h2>{d.limitations.map((l,i)=><p key={i} className="mt-3 text-sm leading-6">{l}</p>)}</footer>
  </article>;
}
