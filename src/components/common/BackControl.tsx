"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const BACK_CONTROL_STYLES =
  "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#D9DEE7] bg-white px-4 text-[14px] font-bold text-[#1D2531] shadow-[0_2px_6px_rgba(15,23,42,0.08)] transition-[background-color,border-color,color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-[#B8C28F] hover:bg-[#F8FCEB] hover:shadow-[0_5px_12px_rgba(15,23,42,0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A5D020] focus-visible:ring-offset-2 active:translate-y-0";

function mergeClassNames(className?: string) {
  return [BACK_CONTROL_STYLES, className].filter(Boolean).join(" ");
}

function BackControlContent({ children }: { children?: ReactNode }) {
  return (
    <>
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      <span>{children ?? "Back"}</span>
    </>
  );
}

export function BackLink({
  href,
  children,
  className,
}: {
  href: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={mergeClassNames(className)}>
      <BackControlContent>{children}</BackControlContent>
    </Link>
  );
}

export const BackButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(function BackButton({ children, className, type = "button", ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={mergeClassNames(className)}
      {...props}
    >
      <BackControlContent>{children}</BackControlContent>
    </button>
  );
});
