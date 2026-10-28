"use client";

import type { ReactNode } from "react";

export function ReportScrollRegion({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <div
      className={className}
      role="region"
      aria-label="Complete fictional Verified Action Plan"
      tabIndex={0}
      onKeyDown={(event) => {
        // Handle only the reader itself; controls inside it retain their keys.
        if (
          event.target !== event.currentTarget ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey
        )
          return;
        if (event.key !== "Home" && event.key !== "End") return;
        event.preventDefault();
        event.currentTarget.scrollTo({
          top: event.key === "Home" ? 0 : event.currentTarget.scrollHeight,
          behavior: "instant",
        });
      }}
    >
      {children}
    </div>
  );
}
