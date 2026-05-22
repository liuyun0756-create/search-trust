"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { GoogleLoginModal } from "@/components/common/GoogleLoginModal";
import { AuditFormModal } from "@/components/common/AuditFormModal";
import { PaymentModal } from "@/components/common/PaymentModal";
import { submitAudit } from "@/lib/submit-audit";

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
  const { isSignedIn } = useUser();
  const [loginOpen, setLoginOpen] = useState(false);
  const [auditFormOpen, setAuditFormOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  // 缓存表单数据，等登录/支付完成后继续
  const [pendingFormData, setPendingFormData] = useState<{ url: string; gbpUrl: string; pageType: string } | null>(null);

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

  // 核心流程：填信息 → 判断登录 → 判断 credits → 跑报告/弹支付
  const handleSubmit = async (data: { url: string; gbpUrl: string; pageType: string }) => {
    // Step 1: 判断登录
    if (!isSignedIn) {
      setPendingFormData(data);
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
          setPendingFormData(data);
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
  };

  // 登录成功回调
  const handleLoginClose = useCallback(() => {
    setLoginOpen(false);
    if (pendingFormData) {
      // 登录完成后重新走流程（判断 credits → 跑报告/支付）
      const data = pendingFormData;
      setPendingFormData(null);
      handleSubmit(data);
    }
  }, [pendingFormData]);

  // 支付成功回调
  const handlePaymentSuccess = useCallback(async () => {
    setPaymentOpen(false);
    await refreshCredits();
    if (pendingFormData) {
      const data = pendingFormData;
      setPendingFormData(null);
      await runReport(data);
    }
  }, [pendingFormData, refreshCredits]);

  const handlePaymentClose = useCallback(() => {
    setPaymentOpen(false);
    setPendingFormData(null);
  }, []);

  // 调后端跑报告
  const runReport = async (data: { url: string; gbpUrl: string; pageType: string }) => {
    setSubmitting(true);
    try {
      const { task_id, report_id } = await submitAudit({
        url: data.url,
        pageType: data.pageType,
        gbpUrl: data.gbpUrl,
      });
      setAuditFormOpen(false);
      router.push(`/reports?task_id=${task_id}&report_id=${report_id}`);
    } catch (error) {
      console.error("Submit error:", error);
      alert(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuditModalContext.Provider value={{ openLogin, openAuditForm, credits, refreshCredits }}>
      {children}
      <GoogleLoginModal isOpen={loginOpen} onClose={handleLoginClose} />
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
    </AuditModalContext.Provider>
  );
}
