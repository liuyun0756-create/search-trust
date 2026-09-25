import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, FileSearch, LockKeyhole, Sparkles } from "lucide-react";

const workflow = [
  ["01", "Start a client Case", "Confirm the business, service and market."],
  ["02", "Build the first diagnosis", "Use public evidence before analytics access."],
  ["03", "Verify with client data", "Connect Search Console and GA4 when the work begins."],
  ["04", "Review before delivery", "Choose the final view, PDF and share version."],
] as const;

export function SignInExperience({ authPanel }: { authPanel: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#edf0e8] p-3 text-[#172019] sm:p-5 lg:p-7">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1460px] overflow-hidden rounded-[30px] bg-white shadow-[0_30px_100px_rgba(28,40,30,0.14)] sm:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[minmax(0,1.05fr)_minmax(470px,.75fr)]">
        <section className="relative overflow-hidden bg-[#172019] px-6 py-7 text-white sm:px-10 sm:py-9 lg:px-14 lg:py-12">
          <div className="absolute -left-28 bottom-[-7rem] h-96 w-96 rounded-full bg-[#a5d020]/12 blur-[100px]" aria-hidden="true" />
          <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:44px_44px]" aria-hidden="true" />

          <div className="relative flex min-h-full flex-col">
            <Link href="/" aria-label="SearchTrust home" className="inline-flex w-fit items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a5d020]">
              <img src="/images/small-logo.png" alt="" className="h-9 w-9" />
              <span className="text-xl font-black tracking-[-0.045em]">Search<span className="text-[#a5d020]">Trust</span></span>
            </Link>

            <div className="my-auto py-14 lg:py-20">
              <div className="flex items-center gap-2 text-[#b8dd3c]"><Sparkles className="h-4 w-4" aria-hidden="true" /><span className="text-[10px] font-black uppercase tracking-[0.2em]">Private SEO workspace</span></div>
              <h1 className="mt-6 max-w-3xl text-balance text-[44px] font-black leading-[0.98] tracking-[-0.06em] sm:text-[58px] xl:text-[68px]">Bring one business. Leave with a defensible next move.</h1>
              <p className="mt-6 max-w-2xl text-sm font-medium leading-7 text-white/55">Keep the prospect diagnosis, client evidence, priorities and delivery version attached to the same Case—from the first conversation to the next review.</p>

              <div className="mt-10 grid gap-3 sm:grid-cols-2">
                {workflow.map(([number, title, description]) => (
                  <div key={number} className="rounded-[20px] bg-white/[0.055] p-4 ring-1 ring-white/[0.07]">
                    <div className="flex items-center gap-3"><span className="font-mono text-[9px] font-black text-[#b8dd3c]">{number}</span><p className="text-sm font-black">{title}</p></div>
                    <p className="mt-2 pl-8 text-xs leading-5 text-white/42">{description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 border-t border-white/10 pt-6 text-xs text-white/55 sm:grid-cols-3">
              <span className="flex items-center gap-2"><Check className="h-4 w-4 text-[#b8dd3c]" aria-hidden="true" />5 permanent credits</span>
              <span className="flex items-center gap-2"><Check className="h-4 w-4 text-[#b8dd3c]" aria-hidden="true" />No subscription</span>
              <span className="flex items-center gap-2"><Check className="h-4 w-4 text-[#b8dd3c]" aria-hidden="true" />Private by default</span>
            </div>
          </div>
        </section>

        <section className="flex min-h-full flex-col px-5 py-7 sm:px-10 sm:py-9 lg:px-12 xl:px-16">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.13em] text-[#697467] transition hover:text-[#172019]"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to site</Link>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#edf2e8] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#62731f]"><LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" /> Secure sign-in</span>
          </div>

          <div className="my-auto py-12">
            <div className="mx-auto max-w-md">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#78931c]">Your Case workspace</p>
              <h2 className="mt-4 text-4xl font-black leading-[1.02] tracking-[-0.055em] text-[#172019]">Continue your client work.</h2>
              <p className="mt-4 text-sm leading-6 text-[#707a6e]">Sign in, or create an account to receive 5 permanent credits. We will take you to the Case setup next.</p>

              <div className="mt-7">{authPanel}</div>

              <div className="mt-7 rounded-[22px] bg-[#f1f4ed] p-5">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-[#76911d]"><FileSearch className="h-4 w-4" aria-hidden="true" /></span>
                  <div>
                    <p className="text-sm font-black text-[#273329]">Know the credit boundary before you begin.</p>
                    <ul className="mt-3 space-y-2 text-xs leading-5 text-[#6e786c]">
                      <li className="flex gap-2"><span className="font-black text-[#78931c]">Free</span><span>Case setup, site check, business identity and service/market confirmation.</span></li>
                      <li className="flex gap-2"><span className="font-black text-[#172019]">1 credit</span><span>Competitor discovery plus a complete Prospect Analysis, or one Verified Action Plan.</span></li>
                    </ul>
                  </div>
                </div>
              </div>

              <Link href="/pricing" className="mt-5 inline-flex items-center gap-2 text-xs font-black text-[#5d711c] transition hover:text-[#172019]">Review pricing and credit rules <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
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
