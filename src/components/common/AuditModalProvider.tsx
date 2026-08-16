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
const OPEN_PURCHASE_AFTER_LOGIN_KEY = "searchtrust_open_purchase_after_login";

type AuditFormData = {
  url: string;
  gbpUrl: string;
  locationContext: string;
  pageType: string;
};

interface AuditModalContextType {
  openLogin: () => void;
  openAuditForm: (initialValues?: Partial<AuditFormData>) => void;
  openPurchase: () => void;
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
  const submissionRef = useRef(false);
  const [credits, setCredits] = useState<number | null>(null);
  const creditsLoadedRef = useRef(false);
  const creditsRequestRef = useRef<Promise<number | null> | null>(null);
  // 缓存表单数据，等登录完成后回填审计表单。
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
        locationContext: parsed.locationContext || "",
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

  const openPurchase = useCallback(() => {
    clearPendingAudit();
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(OPEN_AUDIT_AFTER_LOGIN_KEY);
    }

    if (isLoaded && isSignedIn) {
      track("checkout modal opened", { source: "pricing" });
      setPaymentOpen(true);
      return;
    }

    if (typeof window !== "undefined") {
      sessionStorage.setItem(OPEN_PURCHASE_AFTER_LOGIN_KEY, "1");
    }
    track("login modal opened", { source: "purchase_cta" });
    setLoginOpen(true);
  }, [clearPendingAudit, isLoaded, isSignedIn]);

  const openAuditForm = useCallback((initialValues?: Partial<AuditFormData>) => {
    const defaults = initialValues?.url
      ? {
          url: initialValues.url,
          gbpUrl: initialValues.gbpUrl || "",
          locationContext: initialValues.locationContext || "",
          pageType: initialValues.pageType || "Service Page",
        }
      : null;

    if (isLoaded && isSignedIn) {
      void (async () => {
        const availableCredits = creditsLoadedRef.current ? credits : await refreshCredits();
        if (availableCredits != null && availableCredits <= 0) {
          track("audit blocked no credits", {
            credits_bucket: getCreditsBucket(availableCredits),
            source: "audit_cta_credit_check",
          });
          clearPendingAudit();
          router.push("/pricing");
          return;
        }

        if (defaults) setPendingFormData(defaults);
        track("audit form opened", { source: "cta" });
        setAuditFormOpen(true);
      })();
      return;
    }
    if (defaults) savePendingAudit(defaults);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(OPEN_PURCHASE_AFTER_LOGIN_KEY);
      sessionStorage.setItem(OPEN_AUDIT_AFTER_LOGIN_KEY, "1");
    }
    track("login modal opened", { source: "audit_cta" });
    setLoginOpen(true);
  }, [clearPendingAudit, credits, isLoaded, isSignedIn, refreshCredits, router, savePendingAudit]);

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
    if (submissionRef.current) return;
    submissionRef.current = true;
    setSubmitting(true);
    try {
      const result = await submitAudit({
        url: data.url,
        pageType: data.pageType,
        gbpUrl: data.gbpUrl,
        locationContext: data.locationContext,
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
        setAuditFormOpen(false);
        clearPendingAudit();
        router.push("/pricing");
        return;
      }
      alert(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      submissionRef.current = false;
      setSubmitting(false);
    }
  }, [buildReportRoute, clearPendingAudit, router]);

  // 审计提交仍在服务端兜底检查 credits，避免前端缓存过期。
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
        setAuditFormOpen(false);
        clearPendingAudit();
        router.push("/pricing");
        return;
      }
    } catch {
      // credits 查询失败，继续执行（API 会兜底校验）
    }

    // Step 3: 跑报告
    await runReport(data);
  }, [clearPendingAudit, credits, isSignedIn, refreshCredits, router, runReport, savePendingAudit]);

  // Clerk/OAuth 回来后页面可能已刷新；如果之前已有表单数据，回填表单让用户确认后再提交。
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (typeof window === "undefined") return;

    if (sessionStorage.getItem(OPEN_PURCHASE_AFTER_LOGIN_KEY) === "1") {
      sessionStorage.removeItem(OPEN_PURCHASE_AFTER_LOGIN_KEY);
      sessionStorage.removeItem(OPEN_AUDIT_AFTER_LOGIN_KEY);
      setLoginOpen(false);
      clearPendingAudit();
      track("checkout modal opened", { source: "login_return" });
      setPaymentOpen(true);
      return;
    }

    if (sessionStorage.getItem(OPEN_AUDIT_AFTER_LOGIN_KEY) !== "1") return;

    sessionStorage.removeItem(OPEN_AUDIT_AFTER_LOGIN_KEY);
    setLoginOpen(false);

    const pending = readPendingAudit();
    openAuditForm(pending || undefined);
  }, [clearPendingAudit, isLoaded, isSignedIn, openAuditForm, readPendingAudit]);

  const handlePaymentClose = useCallback(() => {
    setPaymentOpen(false);
    clearPendingAudit();
  }, [clearPendingAudit]);

  return (
    <AuditModalContext.Provider value={{ openLogin, openAuditForm, openPurchase, submitAuditForm: handleSubmit, credits, refreshCredits }}>
      {children}
      <GoogleLoginModal
        isOpen={loginOpen}
        onClose={() => {
          setLoginOpen(false);
          clearPendingAudit();
          if (typeof window !== "undefined") {
            sessionStorage.removeItem(OPEN_AUDIT_AFTER_LOGIN_KEY);
            sessionStorage.removeItem(OPEN_PURCHASE_AFTER_LOGIN_KEY);
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
      />
    </AuditModalContext.Provider>
  );
}
