"use client";

import { useUser } from "@clerk/nextjs";
import { useAuditModal } from "@/components/common/AuditModalProvider";

interface RunAuditButtonProps {
  className?: string;
  children: React.ReactNode;
}

export function RunAuditButton({ className, children }: RunAuditButtonProps) {
  const { isSignedIn } = useUser();
  const { openLogin, openAuditForm } = useAuditModal();

  const handleClick = () => {
    if (isSignedIn) {
      openAuditForm();
    } else {
      openLogin();
    }
  };

  return (
    <button onClick={handleClick} className={className}>
      {children}
    </button>
  );
}
