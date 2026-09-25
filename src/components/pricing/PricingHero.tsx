"use client";

import { motion } from "framer-motion";
import { ArrowRight, Check, Coins, Gift } from "lucide-react";

import { RunAuditButton } from "@/components/common/RunAuditButton";
import { useAppUser } from "@/lib/client-auth";

import { CreditPurchaseButton } from "./CreditPurchaseButton";

export function PricingHero() {
  const { isLoaded, isSignedIn } = useAppUser();
  const startLabel = isLoaded && isSignedIn
    ? "Start a Case"
    : "Create account — get 5 credits";

  return (
    <section className="relative overflow-hidden bg-[#f3f4ed] px-4 pb-24 pt-16 sm:px-6 sm:pb-32 sm:pt-24 lg:px-8">
      <div aria-hidden="true" className="absolute inset-0 opacity-55 [background-image:linear-gradient(rgba(24,32,24,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(24,32,24,0.045)_1px,transparent_1px)] [background-size:54px_54px]" />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative mx-auto max-w-7xl">
        <div className="max-w-5xl">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#718d18]">One balance. Two workflows. No subscription.</p>
          <h1 className="mt-5 font-[family-name:Georgia] text-5xl leading-[0.98] tracking-[-0.055em] text-[#182018] sm:text-7xl">
            Start with 5 permanent credits. Add more only when you need them.
          </h1>
          <p className="mt-7 max-w-3xl text-lg leading-8 text-[#667064]">
            Every new account receives five credits once. Use one credit for a complete Prospect analysis or one Verified Action Plan generation. Additional credits are $19 each and never expire.
          </p>
        </div>

        <div className="mt-14 grid overflow-hidden rounded-[2.2rem] border border-[#d4dacb] bg-white shadow-[0_28px_90px_rgba(24,32,24,0.1)] lg:grid-cols-[1.18fr_0.82fr]">
          <div className="relative overflow-hidden bg-[#b8e626] p-8 text-[#172018] sm:p-12 lg:p-14">
            <div aria-hidden="true" className="absolute -right-28 -top-28 h-80 w-80 rounded-full border-[54px] border-white/20" />
            <div className="relative flex h-full flex-col justify-between">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-[#172018]/15 bg-white/30 px-3 py-1.5 text-xs font-black">
                  <Gift className="h-4 w-4" /> Included with your account
                </span>
                <div className="mt-9 flex items-end gap-4">
                  <span className="font-[family-name:Georgia] text-8xl leading-none tracking-[-0.07em]">5</span>
                  <span className="pb-2 text-lg font-black">credits</span>
                </div>
                <p className="mt-5 text-sm font-black uppercase tracking-[0.18em] text-[#33411d]">$0 · added once · never expires</p>
                <p className="mt-6 max-w-lg text-base leading-7 text-[#33411d]">
                  Enough to run five paid workflows in any mix of Prospect analyses and Verified Action Plan generations.
                </p>
              </div>
              <RunAuditButton
                trackingSource="pricing_free_credits"
                className="group mt-10 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#172018] px-6 py-4 text-sm font-black text-white transition hover:bg-[#273328]"
              >
                {startLabel} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </RunAuditButton>
            </div>
          </div>

          <div className="flex flex-col justify-between bg-[#172018] p-8 text-white sm:p-12 lg:p-14">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#b8e626]/25 bg-[#b8e626]/10 px-3 py-1.5 text-xs font-black text-[#d8ff66]">
                <Coins className="h-4 w-4" /> Additional credit
              </span>
              <div className="mt-9 flex items-end gap-3">
                <span className="font-[family-name:Georgia] text-7xl leading-none tracking-[-0.06em]">$19</span>
                <span className="pb-2 text-sm font-black text-white/55">USD</span>
              </div>
              <ul className="mt-8 space-y-4 text-sm text-white/72">
                {["One-time purchase", "No bundle or minimum commitment", "Shared across all your Cases", "Never expires"].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <Check className="h-4 w-4 shrink-0 text-[#b8e626]" /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <CreditPurchaseButton trackingSource="pricing_additional_credit" className="group mt-10 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-4 text-sm font-black text-[#172018] transition hover:bg-[#f2f5e9] disabled:opacity-60">
              Add 1 credit · $19 <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </CreditPurchaseButton>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
