"use client";

import { ChevronLeft, ChevronRight, MoveHorizontal } from "lucide-react";
import {
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export function HorizontalScrollArea({
  children,
  className = "",
  label = "Horizontally scrollable content",
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, startX: 0, startScrollLeft: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [scrollState, setScrollState] = useState({
    canScroll: false,
    canScrollLeft: false,
    canScrollRight: false,
  });

  const updateScrollState = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
    setScrollState({
      canScroll: maxScrollLeft > 2,
      canScrollLeft: element.scrollLeft > 2,
      canScrollRight: element.scrollLeft < maxScrollLeft - 2,
    });
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    updateScrollState();
    element.addEventListener("scroll", updateScrollState, { passive: true });
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(element);
    if (element.firstElementChild) resizeObserver.observe(element.firstElementChild);

    return () => {
      element.removeEventListener("scroll", updateScrollState);
      resizeObserver.disconnect();
    };
  }, [updateScrollState]);

  const scroll = (direction: -1 | 1) => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollBy({
      left: direction * Math.min(480, element.clientWidth * 0.72),
      behavior: "smooth",
    });
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const element = scrollRef.current;
    if (!element || !scrollState.canScroll || event.pointerType !== "mouse" || event.button !== 0) return;

    dragRef.current = {
      active: true,
      startX: event.clientX,
      startScrollLeft: element.scrollLeft,
    };
    element.focus({ preventScroll: true });
    setIsDragging(true);
    element.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const element = scrollRef.current;
    if (!element || !dragRef.current.active) return;
    element.scrollLeft = dragRef.current.startScrollLeft - (event.clientX - dragRef.current.startX);
  };

  const stopDragging = (event: ReactPointerEvent<HTMLDivElement>) => {
    const element = scrollRef.current;
    dragRef.current.active = false;
    setIsDragging(false);
    if (element?.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
  };

  return (
    <div className="group/horizontal-scroll relative">
      <div
        ref={scrollRef}
        className={`overflow-x-auto ${scrollState.canScroll ? (isDragging ? "cursor-grabbing select-none" : "cursor-grab") : ""} ${className}`}
        tabIndex={scrollState.canScroll ? 0 : undefined}
        role={scrollState.canScroll ? "region" : undefined}
        aria-label={scrollState.canScroll ? label : undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
      >
        {children}
      </div>

      {scrollState.canScroll && (
        <>
          <div
            className={`pointer-events-none absolute inset-y-0 left-0 z-[1] w-12 bg-gradient-to-r from-white to-transparent transition-opacity ${
              scrollState.canScrollLeft ? "opacity-0 group-hover/horizontal-scroll:opacity-100 group-focus-within/horizontal-scroll:opacity-100" : "opacity-0"
            }`}
          />
          <div
            className={`pointer-events-none absolute inset-y-0 right-0 z-[1] w-12 bg-gradient-to-l from-white to-transparent transition-opacity ${
              scrollState.canScrollRight ? "opacity-0 group-hover/horizontal-scroll:opacity-100 group-focus-within/horizontal-scroll:opacity-100" : "opacity-0"
            }`}
          />
          <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full border border-gray-200 bg-white/95 p-1 text-gray-500 opacity-0 shadow-md backdrop-blur transition-opacity group-hover/horizontal-scroll:opacity-100 group-focus-within/horizontal-scroll:opacity-100">
            <span className="flex items-center gap-1.5 px-2 text-[10px] font-bold uppercase tracking-wide">
              <MoveHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              Scroll
            </span>
            <button
              type="button"
              onClick={() => scroll(-1)}
              disabled={!scrollState.canScrollLeft}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition hover:border-[#A5D020] hover:text-[#708B13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A5D020] disabled:cursor-default disabled:opacity-30"
              aria-label="Scroll table left"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => scroll(1)}
              disabled={!scrollState.canScrollRight}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition hover:border-[#A5D020] hover:text-[#708B13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A5D020] disabled:cursor-default disabled:opacity-30"
              aria-label="Scroll table right"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
