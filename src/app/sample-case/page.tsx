import Link from "next/link";
import { SampleReportContent } from "@/components/report/SampleReportContent";
import { BackLink } from "@/components/common/BackControl";

export const metadata = {
  title: "Sample Case — SearchTrust",
  description: "Explore a complete sample L1-L8 trust audit with evidence, actions, an implementation roadmap, and client-ready delivery.",
};

export default function SampleCasePage() {
  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <BackLink href="/sample-report" />
          <Link href="/" className="flex items-center">
            <img src="/images/logo.png" alt="SearchTrust" className="h-6 md:h-8 w-auto" />
          </Link>
        </div>
      </div>
      <SampleReportContent />
    </div>
  );
}
