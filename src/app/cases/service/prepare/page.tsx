import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createServerCaseService, type CasePage } from "@/lib/cases";
import { isFirstServiceSetupEnabled } from "@/lib/first-service-setup/config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Choose a service client | SearchTrust", robots: { index: false, follow: false } };

export default async function PrepareServicePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  if (!isFirstServiceSetupEnabled()) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?redirect_url=%2Fcases%2Fservice%2Fprepare");
  const rawPage = (await searchParams).page ?? "1";
  const page = /^\d{1,5}$/.test(rawPage) ? Math.max(1, Number(rawPage)) : 1;
  let result: CasePage | null = null;
  try { result = await createServerCaseService().list(user.userId, { status: "active", limit: 20, offset: (page - 1) * 20 }); }
  catch { /* Render a retriable error, never an empty-success list. */ }
  return <main className="min-h-screen bg-[#f7faf7] px-5 py-12 text-[#1d2a22] sm:px-8"><div className="mx-auto max-w-4xl">
    <Link href="/cases/service" className="text-sm font-semibold underline">← Client work</Link>
    <p className="mt-10 text-xs font-bold uppercase tracking-widest text-[#668a50]">First service / free preparation</p>
    <h1 className="mt-3 text-4xl font-semibold tracking-tight">Which client are you working with?</h1>
    <p className="mt-4 max-w-2xl leading-7 text-[#657267]">Use an existing Case or save a client you already serve. You do not need to buy a Prospect report. Preparation does not use credit; paid first-service analysis is not available yet.</p>
    <Link href="/cases/service/new" className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-[#26432e] px-5 font-semibold text-white">Add a client</Link>
    <section aria-labelledby="saved-clients" className="mt-10 rounded-3xl border border-[#d7e4d2] bg-white p-6 sm:p-8">
      <h2 id="saved-clients" className="text-xl font-semibold">Your saved clients</h2>
      {!result && <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-4 text-amber-900">Clients could not be loaded. <Link className="underline" href={`/cases/service/prepare?page=${page}`}>Try again</Link></p>}
      {result?.items.length === 0 && <p className="mt-5 text-[#657267]">No clients on this page. Add a client or return to the first page.</p>}
      <ul className="mt-5 divide-y divide-[#e1e9df]">{result?.items.map((client) => <li key={client.id} className="flex flex-wrap items-center justify-between gap-4 py-5">
        <div className="min-w-0"><h3 className="font-semibold">{client.business_name}</h3><p className="mt-1 text-sm text-[#657267]">{client.primary_service} · {client.target_market.display_name}</p><p className="mt-1 break-all text-xs text-[#657267]">{client.site_url}</p></div>
        <Link href={`/cases/${client.id}/service-setup`} className="inline-flex min-h-11 items-center rounded-xl border border-[#bdcdbd] px-4 text-sm font-semibold">Prepare client data →</Link>
      </li>)}</ul>
      {result && <nav aria-label="Client pages" className="mt-6 flex items-center gap-5 text-sm">
        {page > 1 && <Link className="underline" href={`/cases/service/prepare?page=${page - 1}`}>Previous page</Link>}
        <span>Page {page}</span>
        {page * 20 < result.total && <Link className="underline" href={`/cases/service/prepare?page=${page + 1}`}>Next page</Link>}
      </nav>}
    </section>
  </div></main>;
}
