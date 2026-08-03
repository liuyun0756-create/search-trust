"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export function PricingPaymentNotice() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<"success" | "failed" | null>(null);

  useEffect(() => {
    const payment = searchParams.get("payment");
    if (payment !== "success" && payment !== "failed") return;

    setStatus(payment);
    setVisible(true);
    router.replace("/pricing", { scroll: false });

    const timer = window.setTimeout(() => setVisible(false), 5000);
    return () => window.clearTimeout(timer);
  }, [router, searchParams]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={`fixed left-1/2 top-6 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full px-5 py-3 text-white shadow-lg ${
            status === "success" ? "bg-[#1D2531]" : "bg-red-600"
          }`}
        >
          {status === "success" ? (
            <CheckCircle2 size={16} className="text-[#A5D020]" />
          ) : (
            <AlertCircle size={16} />
          )}
          <span className="text-sm font-bold">
            {status === "success"
              ? "Payment successful. 1 report credit was added."
              : "Payment was not completed. Please try again."}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
