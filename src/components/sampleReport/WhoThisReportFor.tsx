import { Users, Search, DollarSign, Building2 } from 'lucide-react';
import { SectionHeader } from '@/components/common/SectionHeader';

const audiences = [
  {
    icon: Users,
    role: 'SEO Agencies',
    desc: 'Use it to explain page weakness clearly to clients.',
  },
  {
    icon: Search,
    role: 'Local SEO Specialists',
    desc: 'Use it to diagnose why a page looks relevant but still isn\'t competitive enough.',
  },
  {
    icon: DollarSign,
    role: 'Affiliate Marketers',
    desc: 'Use it to catch generic, templated, or weakly grounded pages before scaling.',
  },
  {
    icon: Building2,
    role: 'Multi-location Businesses',
    desc: 'Use it to evaluate whether a local page can stand as a credible local asset.',
  },
];

export function WhoThisReportFor() {
  return (
    <section className="py-24 bg-[#F9FAFB]">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader title="Who this type of report is for" />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {audiences.map((a) => (
            <div
              key={a.role}
              className="bg-white rounded-[24px] p-8 border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] group hover:shadow-lg transition-shadow duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-[#A5D020]/10 flex items-center justify-center mb-6 group-hover:bg-[#A5D020]/20 transition-colors">
                <a.icon size={22} className="text-[#A5D020]" />
              </div>
              <h3 className="text-[18px] font-bold text-[#1A1F2B] mb-3 leading-snug">
                {a.role}
              </h3>
              <p className="text-[14px] leading-relaxed text-[#6B7280] font-medium">
                {a.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
