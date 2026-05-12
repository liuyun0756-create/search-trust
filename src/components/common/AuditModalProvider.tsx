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

  const openLogin = useCallback(() => setLoginOpen(true), []);
  const openAuditForm = useCallback(() => setAuditFormOpen(true), []);

  return (
    <AuditModalContext.Provider value={{ openLogin, openAuditForm }}>
      {children}
      <GoogleLoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
      <AuditFormModal
        isOpen={auditFormOpen}
        onClose={() => setAuditFormOpen(false)}
        onSubmit={() => {
          setAuditFormOpen(false);
          router.push("/reports");
        }}
      />
    </AuditModalContext.Provider>
  );
}
