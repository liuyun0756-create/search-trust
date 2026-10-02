import { Clock3, FileCheck2, ShieldCheck } from "lucide-react";
import Link from "next/link";

export function IntakePaused() {
  return (
    <div className="min-h-screen bg-[#f7faf7] text-[#1d2a22]">
      <header className="border-b border-[#e3eae2] bg-white">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3 text-[#26432e]">
            <img src="/images/small-logo.png" alt="" className="h-8 w-8 rounded-lg" />
            <span className="text-sm font-bold tracking-tight">SearchTrust</span>
            <span className="rounded-lg bg-[#f2f7f1] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#668a50]">v2.2</span>
          </Link>
          <span className="hidden items-center gap-1.5 text-xs font-semibold text-[#718073] sm:flex">
            <ShieldCheck size={14} className="text-[#57805b]" /> Existing data remains available
          </span>
        </div>
      </header>

      <main className="min-h-[calc(100vh-4rem)] bg-[#f7faf7] px-5 py-16 sm:px-8 lg:py-24">
        <section className="mx-auto max-w-[760px] rounded-2xl border border-[#e3eae2] bg-white p-7 sm:p-12">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef6d9] text-[#6f8f12]">
            <Clock3 size={27} aria-hidden="true" />
          </div>
          <p className="mt-8 text-xs font-black uppercase tracking-[0.2em] text-[#789714]">New report intake paused</p>
          <h1 className="mt-3 max-w-[620px] text-3xl font-black tracking-[-0.04em] text-[#172017] sm:text-5xl">
            We’re briefly pausing new SearchTrust reports.
          </h1>
          <p className="mt-5 max-w-[620px] text-base leading-7 text-[#667066] sm:text-lg">
            Existing Cases, completed reports, payment confirmations, and active task results remain available. Please return shortly to start a new report.
          </p>
          <div className="mt-8 flex items-start gap-3 rounded-2xl border border-[#e0e6da] bg-[#f7f9f4] p-4 text-sm leading-6 text-[#596359]">
            <FileCheck2 className="mt-0.5 shrink-0 text-[#86a91a]" size={19} aria-hidden="true" />
            <p>No saved Case or report is being deleted or changed by this pause.</p>
          </div>
          <Link href="/" className="mt-8 inline-flex min-h-11 items-center rounded-xl bg-[#234b38] px-5 text-sm font-bold text-white outline-none transition hover:bg-[#2c6348] focus-visible:ring-4 focus-visible:ring-[#8ab49a]/35">
            Return to SearchTrust
          </Link>
        </section>
      </main>
    </div>
  );
}
