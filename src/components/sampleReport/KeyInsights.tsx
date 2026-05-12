import { SectionHeader } from '@/components/common/SectionHeader';

const insights = [
  {
    num: '1',
    text: 'The page is not failing because it lacks content volume.',
  },
  {
    num: '2',
    text: 'Its local claim is weakly grounded and unsupported by real-world anchors.',
  },
  {
    num: '3',
    text: 'The business presence is implied, but accountability signals are incomplete.',
  },
  {
    num: '4',
    text: 'The page resembles a scalable city template more than a standalone local destination.',
  },
  {
    num: '5',
    text: 'The best first fix is not "add more text" but strengthen location-service grounding.',
  },
];

export function KeyInsights() {
  return (
    <section className="py-24 bg-[#F9FAFB]">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          tag="Key insights"
          title="Key insights from this sample"
        />

        <div className="max-w-4xl mx-auto space-y-4">
          {insights.map((item) => (
            <div
              key={item.num}
              className="bg-white rounded-xl px-8 py-6 border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex items-start gap-6 group hover:shadow-lg transition-shadow duration-300"
            >
              <div className="w-10 h-10 rounded-full bg-[#F8F9FA] border border-gray-100 flex items-center justify-center shrink-0 group-hover:bg-[#A5D020]/10 group-hover:border-[#A5D020]/20 transition-colors">
                <span className="text-[14px] font-bold text-[#6B7280] group-hover:text-[#A5D020] transition-colors">
                  {item.num}
                </span>
              </div>
              <p className="text-[15px] leading-relaxed text-[#6B7280] font-medium pt-1.5">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
