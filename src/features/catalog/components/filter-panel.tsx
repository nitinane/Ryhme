"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function FilterPanel({ active = 0, children, className = "panel filter-panel", label = "Search and filters" }: { active?: number; children: ReactNode; className?: string; label?: string }) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (disclosure.current && window.matchMedia("(min-width: 48rem)").matches) {
      disclosure.current.open = true;
    }
  }, []);

  return <details ref={disclosure} className={className}>
    <summary>{label} {active > 0 && <span className="muted text-sm">· {active} active</span>}</summary>
    {children}
  </details>;
}
