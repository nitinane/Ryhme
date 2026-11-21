"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function FilterPanel({ active, children }: { active: number; children: ReactNode }) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (disclosure.current && window.matchMedia("(min-width: 48rem)").matches) {
      disclosure.current.open = true;
    }
  }, []);

  return <details ref={disclosure} className="panel filter-panel">
    <summary>Search and filters {active > 0 && <span className="muted text-sm">· {active} active</span>}</summary>
    {children}
  </details>;
}
