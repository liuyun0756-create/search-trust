import { ArrowLeft, CheckCircle2, CreditCard, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";

export type PaymentHandoffStatus =
  | "saving_case"
  | "ready"
  | "creating_checkout"
  | "confirming_payment"
  | "unlocked"
  | "starting_analysis"
  | "analyzing"
  | "analysis_failed"
  | "error";

interface CasePaymentHandoffProps {
  status: PaymentHandoffStatus;
  message: string;
  caseId: string | null;
  onCheckout(): void;
  onRetryAnalysis?(): void;
  onBack(): void;
}

export function CasePaymentHandoff({
  status,
  message,
  caseId,
  onCheckout,
  onRetryAnalysis = () => undefined,
  onBack,
}: CasePaymentHandoffProps) {
  const busy = status === "saving_case" || status === "creating_checkout" || status === "confirming_payment" || status === "starting_analysis" || status === "analyzing";
  const unlocked = ["unlocked", "starting_analysis", "analyzing", "analysis_failed"].includes(status);
  const analyzing = status === "starting_analysis" || status === "analyzing";

  return (
    <section className="overflow-hidden rounded-2xl border border-[#d9dfd3] bg-white shadow-[0_18px_55px_rgba(31,39,27,0.07)]">
      <div className="grid gap-8 p-7 sm:p-9 lg:grid-cols-[1fr_260px] lg:items-center">
        <div>
          <span className={`grid h-12 w-12 place-items-center rounded-full ${unlocked ? "bg-[#edf7d5] text-[#607d08]" : "bg-[#1a211a] text-[#b7dc3f]"}`}>
            {busy ? <LoaderCircle className="animate-spin" size={23} /> : unlocked ? <CheckCircle2 size={24} /> : <LockKeyhole size={22} />}
          </span>
          <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.16em] text-[#718218]">
            {analyzing ? "Building report" : status === "analysis_failed" ? "Analysis needs attention" : unlocked ? "Payment confirmed" : "Case-level checkout"}
          </p>
          <h1 className="mt-2 max-w-xl text-3xl font-bold tracking-[-0.035em] text-[#172017]">
            {analyzing ? "Your evidence-backed report is being built." : status === "analysis_failed" ? "Your payment is safe and the task can resume." : unlocked ? "This Case is unlocked for its first report." : "Keep this purchase attached to the right client."}
          </h1>
          <p aria-live="polite" className="mt-4 max-w-xl text-sm leading-6 text-[#667266]">{message}</p>
          {caseId && <p className="mt-4 break-all font-mono text-[10px] text-[#909990]">Case {caseId}</p>}
        </div>

        <div className="rounded-2xl border border-[#dfe5d8] bg-[#f7f9f3] p-5">
          <div className="flex items-center justify-between border-b border-[#dfe5d8] pb-4">
            <span className="text-xs font-bold text-[#657065]">Prospect report</span>
            <span className="text-xl font-bold text-[#1a231a]">$19</span>
          </div>
          <ul className="mt-4 space-y-3 text-xs leading-5 text-[#667266]">
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 shrink-0 text-[#76970d]" size={14} />One-time purchase</li>
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 shrink-0 text-[#76970d]" size={14} />Secure Dodo Payments checkout</li>
            <li className="flex gap-2"><LockKeyhole className="mt-0.5 shrink-0 text-[#76970d]" size={14} />Unlocks only this Case</li>
          </ul>
          {!unlocked && (
            <button
              type="button"
              onClick={onCheckout}
              disabled={status !== "ready" && status !== "error"}
              className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1a211a] px-5 text-sm font-bold text-white outline-none hover:bg-black disabled:cursor-wait disabled:opacity-55 focus-visible:ring-4 focus-visible:ring-[#A5D020]/45"
            >
              {status === "creating_checkout" ? <LoaderCircle className="animate-spin" size={17} /> : <CreditCard size={17} />}
              {status === "creating_checkout" ? "Opening checkout…" : "Continue to secure checkout"}
            </button>
          )}
          {unlocked && status !== "analysis_failed" && (
            <div className="mt-5 rounded-xl bg-[#eaf4cf] px-4 py-3 text-center text-xs font-bold text-[#56720c]">
              {analyzing ? "Collecting and validating evidence…" : "1 prospect report available"}
            </div>
          )}
          {status === "analysis_failed" && (
            <button type="button" onClick={onRetryAnalysis} className="mt-5 min-h-12 w-full rounded-xl bg-[#1a211a] px-5 text-sm font-bold text-white outline-none hover:bg-black focus-visible:ring-4 focus-visible:ring-[#A5D020]/45">
              Retry analysis
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e8ece4] bg-[#fbfcfa] px-7 py-4 sm:px-9">
        <button type="button" onClick={onBack} className="flex items-center gap-2 text-xs font-bold text-[#697569] underline underline-offset-4"><ArrowLeft size={13} />Return to coverage</button>
        <span className="text-[11px] font-semibold text-[#8a948a]">No subscription · no OAuth</span>
      </div>
    </section>
  );
}
