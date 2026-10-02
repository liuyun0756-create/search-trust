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
    <section className="relative overflow-hidden bg-[#f7faf7] px-4 pb-24 pt-16 sm:px-6 sm:pb-32 sm:pt-24 lg:px-8">
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

        <div className="mt-14 grid overflow-hidden rounded-2xl border border-[#e3eae2] bg-white lg:grid-cols-[1.18fr_0.82fr]">
          <div className="relative overflow-hidden bg-[#eaf3e8] p-8 text-[#1d2a22] sm:p-12 lg:p-14">
            <div className="relative flex h-full flex-col justify-between">
              <div>
                <span className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#42614a]">
                  <Gift className="h-4 w-4" /> Included with your account
                </span>
                <div className="mt-9 flex items-end gap-4">
                  <span className="font-[family-name:Georgia] text-8xl leading-none tracking-[-0.07em]">5</span>
                  <span className="pb-2 text-lg font-black">credits</span>
                </div>
                <p className="mt-5 text-sm font-bold uppercase tracking-[0.18em] text-[#42614a]">$0 · added once · never expires</p>
                <p className="mt-6 max-w-lg text-base leading-7 text-[#647466]">
                  Enough to run five paid workflows in any mix of Prospect analyses and Verified Action Plan generations.
                </p>
              </div>
              <RunAuditButton
                trackingSource="pricing_free_credits"
                className="group mt-10 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-[#26432e] px-6 py-4 text-sm font-semibold text-white transition-colors hover:bg-[#365d40]"
              >
                {startLabel} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </RunAuditButton>
            </div>
          </div>

          <div className="flex flex-col justify-between bg-white p-8 text-[#1d2a22] sm:p-12 lg:p-14">
            <div>
              <span className="inline-flex items-center gap-2 rounded-lg bg-[#f2f7f1] px-3 py-1.5 text-xs font-semibold text-[#527557]">
                <Coins className="h-4 w-4" /> Additional credit
              </span>
              <div className="mt-9 flex items-end gap-3">
                <span className="font-[family-name:Georgia] text-7xl leading-none tracking-[-0.06em]">$19</span>
                <span className="pb-2 text-sm font-bold text-[#718073]">USD</span>
              </div>
              <ul className="mt-8 space-y-4 text-sm text-[#647466]">
                {["One-time purchase", "No bundle or minimum commitment", "Shared across all your Cases", "Never expires"].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <Check className="h-4 w-4 shrink-0 text-[#57805b]" /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <CreditPurchaseButton trackingSource="pricing_additional_credit" className="group mt-10 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-lg border border-[#dfe7dc] bg-white px-6 py-4 text-sm font-semibold text-[#26432e] transition-colors hover:bg-[#f2f7f1] disabled:opacity-60">
              Add 1 credit · $19 <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </CreditPurchaseButton>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
