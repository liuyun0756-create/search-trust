"use client";

import { motion } from "framer-motion";
import { ArrowRight, Check, Coins, Gift, RefreshCw, ShieldCheck } from "lucide-react";

import { CreditPurchaseButton } from "./CreditPurchaseButton";

export function PricingHero() {
  return (
    <section className="relative overflow-hidden bg-[#f3f4ed] px-4 pb-24 pt-16 sm:px-6 sm:pb-32 sm:pt-24 lg:px-8">
      <div aria-hidden="true" className="absolute inset-0 opacity-55 [background-image:linear-gradient(rgba(24,32,24,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(24,32,24,0.045)_1px,transparent_1px)] [background-size:54px_54px]" />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative mx-auto max-w-7xl">
        <div className="max-w-4xl">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#718d18]">Simple, permanent credits</p>
          <h1 className="mt-5 font-[family-name:Georgia] text-5xl leading-[0.98] tracking-[-0.055em] text-[#182018] sm:text-7xl">Use a credit when SearchTrust does the valuable work.</h1>
          <p className="mt-7 max-w-3xl text-lg leading-8 text-[#667064]">Every new authenticated account receives five credits once. They never expire. Use the same balance for Prospect analysis, Verified generation, and future Cases.</p>
        </div>

        <div className="mt-14 grid overflow-hidden rounded-[2.2rem] border border-[#d4dacb] bg-white shadow-[0_28px_90px_rgba(24,32,24,0.1)] lg:grid-cols-[0.82fr_1.18fr]">
          <div className="flex flex-col justify-between bg-[#172018] p-8 text-white sm:p-12 lg:p-14">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#b8e626]/25 bg-[#b8e626]/10 px-3 py-1.5 text-xs font-black text-[#d8ff66]"><Coins className="h-4 w-4" /> One permanent credit</span>
              <div className="mt-9 flex items-end gap-3"><span className="font-[family-name:Georgia] text-7xl leading-none tracking-[-0.06em]">$19</span><span className="pb-2 text-sm font-black text-white/55">USD</span></div>
              <p className="mt-6 max-w-md leading-7 text-white/58">Buy exactly what you need. No subscription, bundle, minimum commitment, or expiration date.</p>
            </div>
            <CreditPurchaseButton trackingSource="pricing_primary" className="group mt-10 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#b8e626] px-6 py-4 text-sm font-black text-[#142013] transition hover:bg-[#d1f75d] disabled:opacity-60">
              Buy 1 credit · $19 <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </CreditPurchaseButton>
          </div>

          <div className="p-8 sm:p-12 lg:p-14">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#b8e626] text-[#172018]"><Gift className="h-5 w-5" /></span>
              <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#718d18]">Included when you join</p><h2 className="mt-1 font-[family-name:Georgia] text-3xl">5 free credits. Permanently yours.</h2></div>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {[
                [ShieldCheck, "Prospect analysis", "Starts the provider-backed competitor discovery and evidence report for one Case."],
                [RefreshCw, "Verified generation", "Builds or regenerates one action plan from the Case's verified source graph."],
                [Check, "Same-Case corrections", "If no competitor is found, add one manually and continue without a second charge."],
                [Check, "Technical failure return", "A technical generation failure restores exactly one credit to the account."],
              ].map(([Icon, title, body]) => {
                const Glyph = Icon as typeof Check;
                return <article key={String(title)} className="rounded-2xl border border-[#dde2d6] bg-[#f8f9f4] p-5">
                  <Glyph className="h-5 w-5 text-[#7f9f1c]" />
                  <h3 className="mt-4 text-sm font-black text-[#182018]">{String(title)}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#667064]">{String(body)}</p>
                </article>;
              })}
            </div>

            <p className="mt-7 text-xs leading-5 text-[#7b8578]">Entering a website and confirming the business does not consume a credit. The charge happens only when the provider-backed workflow starts.</p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
