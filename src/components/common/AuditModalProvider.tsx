"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { GoogleLoginModal } from "@/components/common/GoogleLoginModal";
import { AuditFormModal } from "@/components/common/AuditFormModal";
import { PaymentModal } from "@/components/common/PaymentModal";
import { submitAudit } from "@/lib/submit-audit";
import { Loader2 } from "lucide-react";

const PENDING_AUDIT_STORAGE_KEY = "searchtrust_pending_audit";

type AuditFormData = { url: string; gbpUrl: string; pageType: string };

interface AuditModalContextType {
  openLogin: () => void;
  openAuditForm: () => void;
  credits: number | null;
  refreshCredits: () => Promise<void>;
}

const AuditModalContext = createContext<AuditModalContextType | null>(null);

export function useAuditModal() {
  const ctx = useContext(AuditModalContext);
  if (!ctx) throw new Error("useAuditModal must be used within AuditModalProvider");
  return ctx;
}

export function AuditModalProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
  const [loginOpen, setLoginOpen] = useState(false);
  const [auditFormOpen, setAuditFormOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  // 缓存表单数据，等登录/支付完成后继续
  const [pendingFormData, setPendingFormData] = useState<AuditFormData | null>(null);
  const [continuingPendingAudit, setContinuingPendingAudit] = useState(false);
  const restoredPendingRef = useRef(false);

  const savePendingAudit = useCallback((data: AuditFormData) => {
    setPendingFormData(data);
    restoredPendingRef.current = false;
    if (typeof window === "undefined") return;
    sessionStorage.setItem(PENDING_AUDIT_STORAGE_KEY, JSON.stringify(data));
  }, []);

  const clearPendingAudit = useCallback(() => {
    setPendingFormData(null);
    restoredPendingRef.current = false;
    if (typeof window === "undefined") return;
    sessionStorage.removeItem(PENDING_AUDIT_STORAGE_KEY);
  }, []);

  const readPendingAudit = useCallback((): AuditFormData | null => {
    if (typeof window === "undefined") return null;
    const raw = sessionStorage.getItem(PENDING_AUDIT_STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<AuditFormData>;
      if (!parsed.url || !parsed.gbpUrl || !parsed.pageType) return null;
      return {
        url: parsed.url,
        gbpUrl: parsed.gbpUrl,
        pageType: parsed.pageType,
      };
    } catch {
      return null;
    }
  }, []);

  const refreshCredits = useCallback(async () => {
    try {
      const res = await fetch("/api/user/credits");
      if (res.ok) {
        const data = await res.json();
        if (data.credits != null) setCredits(data.credits);
      }
    } catch {}
  }, []);

  // Fetch credits on sign-in
  useEffect(() => {
    if (isSignedIn) refreshCredits();
  }, [isSignedIn, refreshCredits]);

  const openLogin = useCallback(() => setLoginOpen(true), []);
  const openAuditForm = useCallback(() => setAuditFormOpen(true), []);

  // 调后端跑报告
  const runReport = useCallback(async (data: AuditFormData) => {
    setSubmitting(true);
    try {
      const { report_id } = await submitAudit({
        url: data.url,
        pageType: data.pageType,
        gbpUrl: data.gbpUrl,
      });
      clearPendingAudit();
      setAuditFormOpen(false);
      router.push(`/reports?report_id=${report_id}`);
    } catch (error) {
      console.error("Submit error:", error);
      alert(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [clearPendingAudit, router]);

  // 核心流程：填信息 → 判断登录 → 判断 credits → 跑报告/弹支付
  const handleSubmit = useCallback(async (data: AuditFormData) => {
    // Step 1: 判断登录
    if (!isSignedIn) {
      savePendingAudit(data);
      setAuditFormOpen(false);
      setLoginOpen(true);
      return;
    }

    // Step 2: 判断 credits
    try {
      const creditsRes = await fetch("/api/user/credits");
      if (creditsRes.ok) {
        const { credits } = await creditsRes.json();
        if (credits <= 0) {
          // 弹支付弹窗
          savePendingAudit(data);
          setAuditFormOpen(false);
          setPaymentOpen(true);
          return;
        }
      }
    } catch {
      // credits 查询失败，继续执行（API 会兜底校验）
    }

    // Step 3: 跑报告
    await runReport(data);
  }, [isSignedIn, runReport, savePendingAudit]);

  // Clerk/OAuth 回来后页面可能已刷新，因此从 sessionStorage 恢复并自动继续。
  useEffect(() => {
    if (!isLoaded || !isSignedIn || submitting || continuingPendingAudit || paymentOpen || restoredPendingRef.current) return;
    const pendingAudit = pendingFormData || readPendingAudit();
    if (!pendingAudit) return;

    restoredPendingRef.current = true;
    setContinuingPendingAudit(true);
    setLoginOpen(false);
    setAuditFormOpen(false);
    handleSubmit(pendingAudit).finally(() => setContinuingPendingAudit(false));
  }, [
    isLoaded,
    isSignedIn,
    submitting,
    continuingPendingAudit,
    paymentOpen,
    pendingFormData,
    readPendingAudit,
    handleSubmit,
  ]);

  // 支付成功回调
  const handlePaymentSuccess = useCallback(async () => {
    setPaymentOpen(false);
    await refreshCredits();
    const data = pendingFormData || readPendingAudit();
    if (data) {
      await runReport(data);
    }
  }, [pendingFormData, readPendingAudit, refreshCredits, runReport]);

  const handlePaymentClose = useCallback(() => {
    setPaymentOpen(false);
    clearPendingAudit();
  }, [clearPendingAudit]);

  return (
    <AuditModalContext.Provider value={{ openLogin, openAuditForm, credits, refreshCredits }}>
      {children}
      <GoogleLoginModal
        isOpen={loginOpen}
        onClose={() => {
          setLoginOpen(false);
          clearPendingAudit();
        }}
        onSignInStart={() => setLoginOpen(false)}
      />
      <AuditFormModal
        isOpen={auditFormOpen}
        onClose={() => { setAuditFormOpen(false); setPendingFormData(null); }}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
      <PaymentModal
        isOpen={paymentOpen}
        onClose={handlePaymentClose}
        onSuccess={handlePaymentSuccess}
        formData={pendingFormData}
      />
      {continuingPendingAudit && !paymentOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0B0C0E]/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-[28px] bg-white border border-gray-100 shadow-2xl p-8 text-center">
            <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-[#F8F9FA] border border-gray-100 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-[#A5D020] animate-spin" />
            </div>
            <h2 className="text-[22px] font-bold tracking-tighter text-[#1A212B] mb-2">
              Continuing your audit
            </h2>
            <p className="text-[14px] text-[#6B7280] font-medium leading-relaxed">
              We saved your form details and are starting the report now.
            </p>
          </div>
        </div>
      )}
    </AuditModalContext.Provider>
  );
}
