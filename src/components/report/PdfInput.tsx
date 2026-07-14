"use client";

export function PdfInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-2 block text-[12px] font-black uppercase tracking-[0.12em] text-gray-500">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} maxLength={120} className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[14px] font-medium text-[#1A212B] outline-none focus:border-[#A5D020] focus:ring-4 focus:ring-[#A5D020]/10" /></label>;
}
