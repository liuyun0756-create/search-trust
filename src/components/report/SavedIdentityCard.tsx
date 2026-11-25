import type { identityStatusRows } from "@/lib/identity-review/view";

export function SavedIdentityCard({ rows }: { rows: ReturnType<typeof identityStatusRows> }) {
  return <section aria-label="Identity status" className="rounded-xl bg-[#f3f7f2] p-5">
    <h2 className="text-xl font-semibold">Identity status</h2>
    <dl className="mt-3 grid gap-3 sm:grid-cols-3">{rows.map(({label,value,detail})=>
      <div key={label}><dt className="text-sm">{label}</dt><dd className="font-semibold">{value}</dd>
        {detail ? <dd className="text-sm">{detail}</dd> : null}</div>)}</dl>
  </section>;
}
