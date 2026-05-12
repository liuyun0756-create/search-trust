import { FileText, Clock, ArrowRight } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "My Reports — SearchTrust",
  description: "View your trust audit report history.",
};

export default function ReportsPage() {
  return (
    <div className="bg-[#F8F9FB] min-h-screen selection:bg-[#A5D020]/30">
      <div className="mx-auto max-w-4xl px-6 py-20">
        {/* Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-gray-100 shadow-sm mb-6">
            <div className="w-2 h-2 rounded-full bg-[#A5D020]" />
            <span className="text-[11px] font-black uppercase tracking-widest text-gray-500">
              Dashboard
            </span>
          </div>
          <h1 className="text-[36px] font-bold text-[#1A212B] tracking-tighter mb-3">
            My Reports
          </h1>
          <p className="text-[15px] text-[#6B7280] font-medium leading-relaxed">
            Your trust audit history and saved diagnostics.
          </p>
        </div>

        {/* Empty State */}
        <div className="bg-white rounded-[24px] border border-gray-100 p-16 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#F0F2F5] flex items-center justify-center">
            <FileText size={28} className="text-[#9CA3AF]" />
          </div>
          <h3 className="text-[18px] font-bold text-[#1A212B] mb-2">
            No reports yet
          </h3>
          <p className="text-[14px] text-[#6B7280] font-medium mb-8 max-w-sm mx-auto">
            Run your first trust audit to see results here.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-[#1D2531] px-6 py-3 text-[14px] font-bold text-white hover:bg-black transition-colors"
          >
            Run a Trust Audit
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
