"use client";

import { useAuditModal } from "@/components/common/AuditModalProvider";

interface RunAuditButtonProps {
  className?: string;
  children: React.ReactNode;
}

export function RunAuditButton({ className, children }: RunAuditButtonProps) {
  const { openAuditForm } = useAuditModal();

  return (
    <button onClick={openAuditForm} className={className}>
      {children}
    </button>
  );
}
