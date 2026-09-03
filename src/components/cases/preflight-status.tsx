import { AlertTriangle, LoaderCircle, RotateCcw } from "lucide-react";

interface PreflightStatusProps {
  kind: "loading" | "error";
  title: string;
  message: string;
  progress?: number;
  onRetry?: () => void;
}

export function PreflightStatus({ kind, title, message, progress, onRetry }: PreflightStatusProps) {
  return (
    <section aria-live="polite" className="rounded-2xl border border-[#dfe4d5] bg-white p-6 shadow-[0_18px_55px_rgba(31,39,27,0.06)] sm:p-8">
      <div className="flex items-start gap-4">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${kind === "loading" ? "bg-[#edf6d4] text-[#607d08]" : "bg-[#fff2df] text-[#9a5700]"}`}>
          {kind === "loading" ? <LoaderCircle className="animate-spin motion-reduce:animate-none" size={22} /> : <AlertTriangle size={22} />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold tracking-[-0.02em] text-[#1c241c]">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#637063]">{message}</p>
          {typeof progress === "number" && (
            <div className="mt-5" aria-label={`${progress}% complete`}>
              <div className="h-2 overflow-hidden rounded-full bg-[#e9ede5]">
                <div className="h-full rounded-full bg-[#A5D020] transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }} />
              </div>
              <p className="mt-2 text-xs font-semibold text-[#778177]">{progress}% complete</p>
            </div>
          )}
          {onRetry && (
            <button type="button" onClick={onRetry} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#1c241c] px-4 py-2.5 text-sm font-bold text-white outline-none transition hover:bg-black focus-visible:ring-4 focus-visible:ring-[#A5D020]/35">
              <RotateCcw size={15} /> Try again
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
