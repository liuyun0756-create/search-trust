"use client";

export type AuditLocationMode = "single" | "multi";

interface AuditLocationModeTabsProps {
  value: AuditLocationMode;
  onChange: (value: AuditLocationMode) => void;
  className?: string;
}

const OPTIONS: Array<{ value: AuditLocationMode; label: string }> = [
  { value: "single", label: "Single location" },
  { value: "multi", label: "Multi-location" },
];

export function AuditLocationModeTabs({
  value,
  onChange,
  className = "",
}: AuditLocationModeTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Business location setup"
      className={`inline-flex rounded-xl border border-[#D7DCE4] bg-[#F4F5F7] p-1 ${className}`}
    >
      {OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={`rounded-lg px-5 py-2 text-[13px] font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A5D020]/60 ${
              selected
                ? "bg-[#1A1F2B] text-white shadow-sm"
                : "text-[#697386] hover:bg-white hover:text-[#1A1F2B]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
