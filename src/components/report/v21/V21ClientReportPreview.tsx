"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Download } from "lucide-react";
import type { NormalizedReportV21Result } from "@/lib/report-v21";
import type { Report } from "@/types/database";
import { ReportV21Content } from "./ReportV21Content";

export function V21ClientReportPreview({
  normalized,
  rawReport,
  onClose,
  onCustomizeDownload,
}: {
  normalized: NormalizedReportV21Result;
  rawReport: Report;
  onClose: () => void;
  onCustomizeDownload: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const hiddenSiblings = Array.from(document.body.children)
      .filter((element) => element !== dialogRef.current && !element.contains(dialogRef.current))
      .map((element) => ({
        element: element as HTMLElement,
        ariaHidden: element.getAttribute("aria-hidden"),
        inert: element.hasAttribute("inert"),
      }));
    hiddenSiblings.forEach(({ element }) => {
      element.setAttribute("aria-hidden", "true");
      element.setAttribute("inert", "");
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      hiddenSiblings.forEach(({ element, ariaHidden, inert }) => {
        if (ariaHidden == null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
        if (!inert) element.removeAttribute("inert");
      });
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[60] overflow-y-auto bg-[#F3F5F7]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-report-preview-title"
    >
      <header className="sticky top-0 z-20 border-b border-[#DDE2E8] bg-white/95 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-[72px] max-w-[1600px] items-center gap-3 px-4 py-3 sm:px-6 lg:px-10">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-[13px] font-bold text-[#1A212B] transition-colors hover:border-gray-300 hover:bg-gray-50"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 id="client-report-preview-title" className="whitespace-nowrap text-[14px] font-black tracking-tight text-[#1A212B] sm:text-[18px]">
                Client Report Preview
              </h2>
            </div>
            <p className="mt-0.5 hidden truncate text-[12px] font-medium text-gray-500 md:block">
              Client-facing conclusions, trust-layer status and improvement sequence. Technical details are excluded.
            </p>
          </div>

          <button
            type="button"
            onClick={onCustomizeDownload}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#171B22] px-3.5 text-[13px] font-bold text-white transition-colors hover:bg-black sm:px-4"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Customize &amp; Download</span>
            <span className="sm:hidden">Download</span>
          </button>

        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-3 py-5 sm:px-6 sm:py-7 lg:px-10 lg:py-10">
        <ReportV21Content
          normalized={normalized}
          rawReport={rawReport}
          viewMode="client"
          sectionIdsEnabled={false}
        />
      </div>
    </div>,
    document.body,
  );
}
