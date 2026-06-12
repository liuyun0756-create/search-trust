import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SampleReportContent } from "@/components/report/SampleReportContent";

export const metadata = {
  title: "Sample Case — SearchTrust",
  description: "Explore a full sample trust audit report with all five stages unlocked.",
};

export default function SampleCasePage() {
  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[14px] font-bold text-[#657083] hover:text-[#1D2531] transition-colors">
            <ArrowLeft size={16} />
            Back to SearchTrust
          </Link>
          <Link href="/" className="flex items-center">
            <img src="/images/logo.png" alt="SearchTrust" className="h-6 md:h-8 w-auto" />
          </Link>
        </div>
      </div>
      <SampleReportContent />
    </div>
  );
}
