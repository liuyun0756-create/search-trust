"use client";

import { useAuditModal } from "@/components/common/AuditModalProvider";
import { track } from "@/lib/analytics-client";

interface PurchaseReportButtonProps {
  className?: string;
  children: React.ReactNode;
  trackingSource?: string;
}

export function PurchaseReportButton({
  className,
  children,
  trackingSource = "pricing",
}: PurchaseReportButtonProps) {
  const { openPurchase } = useAuditModal();

  return (
    <button
      type="button"
      onClick={() => {
        track("purchase cta clicked", { source: trackingSource });
        openPurchase();
      }}
      className={className}
    >
      {children}
    </button>
  );
}
