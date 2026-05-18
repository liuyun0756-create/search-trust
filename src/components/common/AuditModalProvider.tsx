"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { GoogleLoginModal } from "@/components/common/GoogleLoginModal";
import { AuditFormModal } from "@/components/common/AuditFormModal";

interface AuditModalContextType {
  openLogin: () => void;
  openAuditForm: () => void;
}

const AuditModalContext = createContext<AuditModalContextType | null>(null);

export function useAuditModal() {
  const ctx = useContext(AuditModalContext);
  if (!ctx) throw new Error("useAuditModal must be used within AuditModalProvider");
  return ctx;
}

export function AuditModalProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [loginOpen, setLoginOpen] = useState(false);
  const [auditFormOpen, setAuditFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const openLogin = useCallback(() => setLoginOpen(true), []);
  const openAuditForm = useCallback(() => setAuditFormOpen(true), []);

  const handleSubmit = async (data: { url: string; gbpUrl: string; pageType: string }) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: data.url,
          page_type: data.pageType,
          gbp_url: data.gbpUrl || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to generate report");
        return;
      }

      const { task_id, report_id } = await res.json();
      setAuditFormOpen(false);
      router.push(`/reports?task_id=${task_id}&report_id=${report_id}`);
    } catch (error) {
      console.error("Submit error:", error);
      alert("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuditModalContext.Provider value={{ openLogin, openAuditForm }}>
      {children}
      <GoogleLoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
      <AuditFormModal
        isOpen={auditFormOpen}
        onClose={() => setAuditFormOpen(false)}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    </AuditModalContext.Provider>
  );
}
