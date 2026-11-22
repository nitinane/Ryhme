"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function FilterPanel({ active = 0, children, className = "panel filter-panel", label = "Search and filters", desktopOpen = true }: { active?: number; children: ReactNode; className?: string; label?: string; desktopOpen?: boolean }) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (desktopOpen && disclosure.current && window.matchMedia("(min-width: 48rem)").matches) {
      disclosure.current.open = true;
    }
  }, [desktopOpen]);

  return <details ref={disclosure} className={className}>
    <summary>{label} {active > 0 && <span className="muted text-sm">· {active} active</span>}</summary>
    {children}
  </details>;
}
