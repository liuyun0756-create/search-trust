"use client";

export function PdfInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex min-h-9 items-end text-[12px] font-black uppercase tracking-[0.12em] text-gray-500">
        {label}
      </span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        maxLength={120}
        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[14px] font-medium text-[#1A212B] outline-none placeholder:text-gray-300 focus:border-[#A5D020] focus:ring-4 focus:ring-[#A5D020]/10"
      />
    </label>
  );
}
