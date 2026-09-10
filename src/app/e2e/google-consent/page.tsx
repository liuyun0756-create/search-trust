import Link from "next/link";
import { notFound } from "next/navigation";

import { isLocalE2ETestMode } from "@/lib/e2e-v22/config";

export default async function LocalGoogleConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string }>;
}) {
  if (!isLocalE2ETestMode()) notFound();
  const query = await searchParams;
  const returnTo = typeof query.return_to === "string" && query.return_to.startsWith("/cases/")
    ? query.return_to
    : "/cases";
  const success = `${returnTo}?google_connection=success&code=AUTHORIZED`;
  const denied = `${returnTo}?google_connection=error&code=GOOGLE_AUTHORIZATION_DENIED`;

  return <main className="grid min-h-screen place-items-center bg-[#f3f4ed] p-6">
    <section className="w-full max-w-lg rounded-3xl border border-[#d9ded3] bg-white p-8 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#718218]">Local browser fixture</p>
      <h1 className="mt-3 text-3xl font-bold text-[#172017]">Simulated Google consent</h1>
      <p className="mt-3 text-sm leading-6 text-[#657165]">No Google request is made. Choose the deterministic callback outcome for this test.</p>
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <Link href={success} className="rounded-xl bg-[#1a211a] px-5 py-3 text-center text-sm font-bold text-white">Authorize</Link>
        <Link href={denied} className="rounded-xl border border-[#d9ded3] px-5 py-3 text-center text-sm font-bold text-[#4f5a4f]">Deny</Link>
      </div>
    </section>
  </main>;
}
