"use client";

import { useAuditModal } from "@/components/common/AuditModalProvider";
import { track } from "@/lib/analytics-client";

interface RunAuditButtonProps {
  className?: string;
  children: React.ReactNode;
  trackingSource?: string;
}

export function RunAuditButton({
  className,
  children,
  trackingSource = "unknown",
}: RunAuditButtonProps) {
  const { openAuditForm } = useAuditModal();

  return (
    <button
      onClick={() => {
        track("audit cta clicked", { source: trackingSource });
        openAuditForm();
      }}
      className={className}
    >
      {children}
    </button>
  );
}
