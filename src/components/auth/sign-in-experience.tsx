import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, FileSearch, LockKeyhole } from "lucide-react";

const workflow = [
  ["01", "Start a client Case", "Confirm the business, service and market."],
  ["02", "Build the first diagnosis", "Use public evidence before analytics access."],
  ["03", "Verify with client data", "Connect Search Console and GA4 when the work begins."],
  ["04", "Review before delivery", "Choose the final view, PDF and share version."],
] as const;

export function SignInExperience({ authPanel }: { authPanel: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7faf7] p-3 text-[#1d2a22] sm:p-5 lg:p-7">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1460px] overflow-hidden rounded-2xl border border-[#e3eae2] bg-white sm:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[minmax(0,1.05fr)_minmax(440px,.75fr)]">
        <section className="flex flex-col bg-[#f2f7f1] px-6 py-7 sm:px-10 sm:py-9 lg:px-14 lg:py-12">
          <div className="flex min-h-full flex-col">
            <Link href="/" aria-label="SearchTrust home" className="inline-flex w-fit items-center gap-2.5 rounded-lg">
              <img src="/images/small-logo.png" alt="" className="h-9 w-9" />
              <span className="text-xl font-bold tracking-[-0.045em] text-[#26432e]">Search<span className="text-[#68a44d]">Trust</span></span>
            </Link>

            <div className="my-auto py-14 lg:py-16">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#668a50]">Private SEO workspace</p>
              <h1 className="mt-6 max-w-3xl text-balance text-[44px] font-bold leading-[1.02] tracking-[-0.06em] text-[#1d2a22] sm:text-[54px] xl:text-[62px]">Bring one business. Leave with a defensible next move.</h1>
              <p className="mt-6 max-w-2xl text-sm leading-7 text-[#647466]">Keep the prospect diagnosis, client evidence, priorities and delivery version attached to the same Case—from the first conversation to the next review.</p>

              <div className="mt-10 grid gap-x-7 gap-y-6 sm:grid-cols-2">
                {workflow.map(([number, title, description]) => (
                  <div key={number}>
                    <div className="flex items-center gap-3"><span className="font-mono text-[10px] font-bold text-[#5b8a5e]">{number}</span><p className="text-sm font-semibold text-[#26432e]">{title}</p></div>
                    <p className="mt-1.5 pl-7 text-xs leading-5 text-[#718073]">{description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 pt-6 text-xs text-[#527557] sm:grid-cols-3">
              <span className="flex items-center gap-2"><Check className="h-4 w-4" aria-hidden="true" />5 permanent credits</span>
              <span className="flex items-center gap-2"><Check className="h-4 w-4" aria-hidden="true" />No subscription</span>
              <span className="flex items-center gap-2"><Check className="h-4 w-4" aria-hidden="true" />Private by default</span>
            </div>
          </div>
        </section>

        <section className="flex min-h-full flex-col px-5 py-7 sm:px-10 sm:py-9 lg:px-12 xl:px-16">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-[#647466] transition hover:text-[#26432e]"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to site</Link>
            <span className="inline-flex items-center gap-2 rounded-lg bg-[#f2f7f1] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#527557]"><LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" /> Secure sign-in</span>
          </div>

          <div className="my-auto py-12">
            <div className="mx-auto max-w-md">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#668a50]">Your Case workspace</p>
              <h2 className="mt-4 text-4xl font-bold leading-[1.02] tracking-[-0.055em] text-[#1d2a22]">Continue your client work.</h2>
              <p className="mt-4 text-sm leading-6 text-[#647466]">Sign in, or create an account to receive 5 permanent credits. We will take you to the Case setup next.</p>

              <div className="mt-7">{authPanel}</div>

              <div className="mt-7 rounded-xl bg-[#f2f7f1] p-5">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-[#57805b]"><FileSearch className="h-4 w-4" aria-hidden="true" /></span>
                  <div>
                    <p className="text-sm font-semibold text-[#26432e]">Know the credit boundary before you begin.</p>
                    <ul className="mt-3 space-y-2 text-xs leading-5 text-[#6e786c]">
                      <li className="flex gap-2"><span className="font-bold text-[#57805b]">Free</span><span>Case setup, site check, business identity and service/market confirmation.</span></li>
                      <li className="flex gap-2"><span className="font-bold text-[#26432e]">1 credit</span><span>Competitor discovery plus a complete Prospect Analysis, or one Verified Action Plan.</span></li>
                    </ul>
                  </div>
                </div>
              </div>

              <Link href="/pricing" className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-[#42614a] transition hover:text-[#26432e]">Review pricing and credit rules <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e2e6dd] pt-5 text-[11px] text-[#899187]">
            <p>By continuing, you agree to the SearchTrust terms.</p>
            <div className="flex gap-4"><Link href="/terms" className="hover:text-[#172019]">Terms</Link><Link href="/privacy" className="hover:text-[#172019]">Privacy</Link></div>
          </div>
        </section>
      </div>
    </div>
  );
}
