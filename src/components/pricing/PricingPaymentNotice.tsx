"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export function PricingPaymentNotice() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (searchParams.get("payment") !== "failed") return;

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
          className="fixed left-1/2 top-6 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-red-600 px-5 py-3 text-white shadow-lg"
        >
          <AlertCircle size={16} />
          <span className="text-sm font-bold">Payment was not completed. Please try again.</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
