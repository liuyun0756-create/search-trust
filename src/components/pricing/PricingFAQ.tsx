const faqData = [
  {
    q: 'Is this a recurring subscription?',
    a: 'No. This is a one-time purchase.',
  },
  {
    q: 'Does one purchase include multiple pages?',
    a: 'No. Each purchase covers one single URL.',
  },
  {
    q: 'Is payment handled securely?',
    a: 'Yes. All payments are processed securely via Dodo Payments.',
  },
];

export function PricingFAQ() {
  return (
    <section className="py-40 bg-white">
      <div className="max-w-[800px] mx-auto px-8">
        <h2 className="text-center text-[42px] font-bold mb-24">Common questions</h2>
        <div className="space-y-16">
          {faqData.map((faq, i) => (
            <div key={i} className="group cursor-default border-b border-gray-100 pb-12">
              <h4 className="text-[22px] font-bold mb-4 group-hover:text-[#A5D020] transition-colors">
                {faq.q}
              </h4>
              <p className="text-lg text-[#3E4651] font-medium opacity-50">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
