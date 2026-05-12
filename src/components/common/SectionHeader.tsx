interface SectionHeaderProps {
  tag?: string;
  title: string;
  description?: string;
  className?: string;
}

export function SectionHeader({ tag, title, description, className = "" }: SectionHeaderProps) {
  return (
    <div className={`text-center mb-16 ${className}`}>
      {tag && (
        <div className="inline-block px-3 py-1 rounded-full bg-[#F4F7E9] text-[#A5D020] text-[12px] font-bold mb-6">
          {tag}
        </div>
      )}
      <h2 className="text-[36px] md:text-[44px] font-bold text-[#1A1F2B] leading-[1.2]">
        {title}
      </h2>
      {description && (
        <p className="mt-6 text-[16px] text-[#6B7280] leading-relaxed max-w-3xl mx-auto font-medium">
          {description}
        </p>
      )}
    </div>
  );
}
