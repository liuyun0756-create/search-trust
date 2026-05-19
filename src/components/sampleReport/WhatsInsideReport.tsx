import { FileText, BarChart3, Target, Layers, Compass, Zap } from 'lucide-react';
import { SectionHeader } from '@/components/common/SectionHeader';

const sections = [
  {
    icon: BarChart3,
    title: 'Current trust status',
    desc: 'A page-level summary of current structural trust strength.',
  },
  {
    icon: Compass,
    title: 'Page interpretation',
    desc: 'Why the page can participate, stall, or stay unstable.',
  },
  {
    icon: Target,
    title: 'Dominant failure layer',
    desc: 'The layer where trust breakdown matters most.',
  },
  {
    icon: Layers,
    title: 'Key issues by layer',
    desc: 'Weaknesses organized through the six-layer model.',
  },
  {
    icon: Zap,
    title: 'Prioritized improvement path',
    desc: 'What to fix first, next, and later.',
  },
  {
    icon: FileText,
    title: 'Strategic recommendations',
    desc: 'Guidance focused on trust impact, not just issue listing.',
  },
];

export function WhatsInsideReport() {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader title="What's inside the report" />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {sections.map((s) => (
            <div
              key={s.title}
              className="bg-[#F8F9FA] rounded-[24px] p-8 border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] group hover:shadow-lg transition-shadow duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-50 mb-6">
                <s.icon size={22} className="text-[#A5D020]" />
              </div>
              <h3 className="text-[18px] font-bold text-[#1A1F2B] mb-3 leading-snug">
                {s.title}
              </h3>
              <p className="text-[14px] leading-relaxed text-[#6B7280] font-medium opacity-90">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
