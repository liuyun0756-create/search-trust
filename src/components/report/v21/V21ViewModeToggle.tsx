import type { V21ViewMode } from "./viewMode";

export function V21ViewModeToggle({
  mode,
  onChange,
}: {
  mode: V21ViewMode;
  onChange: (mode: V21ViewMode) => void;
}) {
  return (
    <div className="rounded-[24px] border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-1">
        <p className="text-[12px] font-black uppercase tracking-[0.14em] text-gray-400">Report view</p>
        <p className="text-[13px] font-medium leading-relaxed text-gray-500">
          Switch between client-facing explanation and analyst detail.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 rounded-2xl bg-[#F8F9FA] p-2 sm:grid-cols-2">
        <ModeButton
          active={mode === "client"}
          title="Client View"
          description="Simplified explanation for client reporting."
          onClick={() => onChange("client")}
        />
        <ModeButton
          active={mode === "analyst"}
          title="Analyst View"
          description="Evidence, rules, coverage, and implementation detail."
          onClick={() => onChange("analyst")}
        />
      </div>
    </div>
  );
}

function ModeButton({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-3 text-left transition-all ${
        active
          ? "bg-[#1A1F2B] text-white shadow-sm"
          : "bg-white text-[#1A1F2B] hover:bg-[#F7F9F2]"
      }`}
      aria-pressed={active}
    >
      <span className="block text-[14px] font-black">{title}</span>
      <span className={`mt-1 block text-[12px] font-medium leading-relaxed ${active ? "text-white/70" : "text-gray-500"}`}>
        {description}
      </span>
    </button>
  );
}
