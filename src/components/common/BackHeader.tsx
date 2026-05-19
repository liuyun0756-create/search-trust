import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function BackHeader() {
  return (
    <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-[14px] font-bold text-[#657083] hover:text-[#1D2531] transition-colors">
          <ArrowLeft size={16} />
          Back to SearchTrust
        </Link>
        <div className="flex items-center gap-2">
          <img src="/images/logo.png" alt="" className="h-6 md:h-8 w-auto" />
        </div>
      </div>
    </div>
  );
}
