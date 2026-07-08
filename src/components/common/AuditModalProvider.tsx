"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { GoogleLoginModal } from "@/components/common/GoogleLoginModal";
import { AuditFormModal } from "@/components/common/AuditFormModal";
import { PaymentModal } from "@/components/common/PaymentModal";
import { submitAudit } from "@/lib/submit-audit";
import { track } from "@/lib/analytics-client";
import { getAuditEventProperties, getCreditsBucket } from "@/lib/analytics-properties";

const PENDING_AUDIT_STORAGE_KEY = "searchtrust_pending_audit";
const OPEN_AUDIT_AFTER_LOGIN_KEY = "searchtrust_open_audit_after_login";

type AuditFormData = { url: string; gbpUrl: string; pageType: string };

interface AuditModalContextType {
  openLogin: () => void;
  openAuditForm: () => void;
  submitAuditForm: (data: AuditFormData) => Promise<void>;
  credits: number | null;
  refreshCredits: (options?: { force?: boolean }) => Promise<number | null>;
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
  const creditsLoadedRef = useRef(false);
  const creditsRequestRef = useRef<Promise<number | null> | null>(null);
  // 缓存表单数据，等登录/支付完成后继续
  const [pendingFormData, setPendingFormData] = useState<AuditFormData | null>(null);

  const savePendingAudit = useCallback((data: AuditFormData) => {
    setPendingFormData(data);
    if (typeof window === "undefined") return;
    sessionStorage.setItem(PENDING_AUDIT_STORAGE_KEY, JSON.stringify(data));
  }, []);

  const clearPendingAudit = useCallback(() => {
    setPendingFormData(null);
    if (typeof window === "undefined") return;
    sessionStorage.removeItem(PENDING_AUDIT_STORAGE_KEY);
  }, []);

  const readPendingAudit = useCallback((): AuditFormData | null => {
    if (typeof window === "undefined") return null;
    const raw = sessionStorage.getItem(PENDING_AUDIT_STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<AuditFormData>;
      if (!parsed.url || !parsed.pageType) return null;
      return {
        url: parsed.url,
        gbpUrl: parsed.gbpUrl || "",
        pageType: parsed.pageType,
      };
    } catch {
      return null;
    }
  }, []);

  const refreshCredits = useCallback(async (options?: { force?: boolean }) => {
    if (!options?.force && creditsLoadedRef.current) return credits;
    if (creditsRequestRef.current) return creditsRequestRef.current;

    creditsRequestRef.current = (async () => {
      try {
        const res = await fetch("/api/user/credits");
        if (!res.ok) return credits;
        const data = await res.json();
        const nextCredits = typeof data.credits === "number" ? data.credits : null;
        creditsLoadedRef.current = true;
        setCredits(nextCredits);
        return nextCredits;
      } catch {
        return credits;
      } finally {
        creditsRequestRef.current = null;
      }
    })();

    return creditsRequestRef.current;
  }, [credits]);

  // Fetch credits on sign-in
  useEffect(() => {
    if (isSignedIn) refreshCredits();
    if (isLoaded && !isSignedIn) {
      creditsLoadedRef.current = false;
      setCredits(null);
    }
  }, [isSignedIn, refreshCredits]);

  const openLogin = useCallback(() => {
    track("login modal opened");
    setLoginOpen(true);
  }, []);
  const openAuditForm = useCallback(() => {
    if (isLoaded && isSignedIn) {
      track("audit form opened", { source: "cta" });
      setAuditFormOpen(true);
      return;
    }
    if (typeof window !== "undefined") {
      sessionStorage.setItem(OPEN_AUDIT_AFTER_LOGIN_KEY, "1");
    }
    track("login modal opened", { source: "audit_cta" });
    setLoginOpen(true);
  }, [isLoaded, isSignedIn]);

  const buildReportRoute = useCallback((params: {
    report_id: string;
    task_id?: string | null;
    database_report_id?: string | null;
  }) => {
    const search = new URLSearchParams({ report_id: params.report_id });
    if (params.task_id) search.set("task_id", params.task_id);
    if (params.database_report_id) search.set("database_report_id", params.database_report_id);
    return `/reports?${search.toString()}`;
  }, []);

  // 调后端跑报告
  const runReport = useCallback(async (data: AuditFormData) => {
    setSubmitting(true);
    try {
      const result = await submitAudit({
        url: data.url,
        pageType: data.pageType,
        gbpUrl: data.gbpUrl,
      });
      clearPendingAudit();
      setAuditFormOpen(false);
      router.push(buildReportRoute(result));
    } catch (error) {
      console.error("Submit error:", error);
      const message = error instanceof Error ? error.message : "";
      if (message.includes("No audit credits available")) {
        track(
          "audit blocked no credits",
          getAuditEventProperties(data, {
            credits_bucket: getCreditsBucket(0),
            source: "api_response",
          })
        );
        savePendingAudit(data);
        setAuditFormOpen(false);
        setPaymentOpen(true);
        return;
      }
      alert(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [buildReportRoute, clearPendingAudit, router, savePendingAudit]);

  // 核心流程：填信息 → 判断登录 → 判断 credits → 跑报告/弹支付
  const handleSubmit = useCallback(async (data: AuditFormData) => {
    track(
      "audit submitted",
      getAuditEventProperties(data, {
        signed_in: Boolean(isSignedIn),
        credits_bucket: getCreditsBucket(credits),
      })
    );

    // Step 1: 判断登录
    if (!isSignedIn) {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(OPEN_AUDIT_AFTER_LOGIN_KEY, "1");
      }
      track("login modal opened", { source: "audit_submit" });
      savePendingAudit(data);
      setAuditFormOpen(false);
      setLoginOpen(true);
      return;
    }

    // Step 2: 判断 credits
    try {
      const availableCredits = creditsLoadedRef.current ? credits : await refreshCredits();
      if (availableCredits != null && availableCredits <= 0) {
        track(
          "audit blocked no credits",
          getAuditEventProperties(data, {
            credits_bucket: getCreditsBucket(availableCredits),
            source: "client_credit_check",
          })
        );
        // 弹支付弹窗
        savePendingAudit(data);
        setAuditFormOpen(false);
        setPaymentOpen(true);
        return;
      }
    } catch {
      // credits 查询失败，继续执行（API 会兜底校验）
    }

    // Step 3: 跑报告
    await runReport(data);
  }, [credits, isSignedIn, refreshCredits, runReport, savePendingAudit]);

  // Clerk/OAuth 回来后页面可能已刷新；如果之前已有表单数据，回填表单让用户确认后再提交。
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(OPEN_AUDIT_AFTER_LOGIN_KEY) !== "1") return;

    sessionStorage.removeItem(OPEN_AUDIT_AFTER_LOGIN_KEY);
    setLoginOpen(false);

    const pending = readPendingAudit();
    if (pending) {
      setPendingFormData(pending);
      track(
        "audit form opened",
        getAuditEventProperties(pending, { source: "login_return" })
      );
      setAuditFormOpen(true);
      return;
    }

    track("audit form opened", { source: "login_return" });
    setAuditFormOpen(true);
  }, [handleSubmit, isLoaded, isSignedIn, readPendingAudit]);

  // 支付成功回调
  const handlePaymentSuccess = useCallback(async () => {
    setPaymentOpen(false);
    await refreshCredits({ force: true });
    const data = pendingFormData || readPendingAudit();
    if (data) {
      track(
        "audit submitted",
        getAuditEventProperties(data, {
          source: "payment_success_resume",
          credits_bucket: getCreditsBucket(credits),
        })
      );
      await runReport(data);
    }
  }, [credits, pendingFormData, readPendingAudit, refreshCredits, runReport]);

  const handlePaymentClose = useCallback(() => {
    setPaymentOpen(false);
    clearPendingAudit();
  }, [clearPendingAudit]);

  return (
    <AuditModalContext.Provider value={{ openLogin, openAuditForm, submitAuditForm: handleSubmit, credits, refreshCredits }}>
      {children}
      <GoogleLoginModal
        isOpen={loginOpen}
        onClose={() => {
          setLoginOpen(false);
          clearPendingAudit();
          if (typeof window !== "undefined") {
            sessionStorage.removeItem(OPEN_AUDIT_AFTER_LOGIN_KEY);
          }
        }}
        onSignInStart={() => setLoginOpen(false)}
      />
      <AuditFormModal
        isOpen={auditFormOpen}
        onClose={() => { setAuditFormOpen(false); clearPendingAudit(); }}
        onSubmit={handleSubmit}
        submitting={submitting}
        initialValues={pendingFormData}
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
