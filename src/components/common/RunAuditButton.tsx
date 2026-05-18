"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useAuditModal } from "@/components/common/AuditModalProvider";

interface RunAuditButtonProps {
  className?: string;
  children: React.ReactNode;
}

export function RunAuditButton({ className, children }: RunAuditButtonProps) {
  const { isSignedIn } = useUser();
  const { openLogin, openAuditForm } = useAuditModal();
  const [checking, setChecking] = useState(false);
  const router = useRouter();

  const handleClick = async () => {
    if (!isSignedIn) {
      openLogin();
      return;
    }

    // Check credits before opening audit form
    setChecking(true);
    try {
      const res = await fetch("/api/user/credits");
      if (!res.ok) throw new Error("Failed to fetch credits");
      const { credits } = await res.json();

      if (credits <= 0) {
        router.push("/pricing");
        return;
      }

      openAuditForm();
    } catch {
      // If credit check fails, still open the form — the API will handle it
      openAuditForm();
    } finally {
      setChecking(false);
    }
  };

  return (
    <button onClick={handleClick} disabled={checking} className={className}>
      {children}
    </button>
  );
}
