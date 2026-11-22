"use client";

import Link from "next/link";
import { useId, useRef } from "react";

export function StudioSelector({ label, options }: {
  label: string;
  options: { label: string; href: string; current: boolean }[];
}) {
  const id = useId();
  const popover = useRef<HTMLDivElement>(null);
  const current = options.find(option => option.current);

  return <div className="studio-selector">
    <button type="button" className="studio-selector-trigger" popoverTarget={id}>
      <span>{label}</span><strong>{current?.label ?? "Choose"}</strong>
    </button>
    <div id={id} ref={popover} popover="auto" className="studio-selector-menu">
      <nav aria-label={label}>
        {options.map(option => <Link key={option.href} href={option.href} scroll={false}
          aria-current={option.current ? "true" : undefined} onClick={() => popover.current?.hidePopover()}>
          {option.label}
        </Link>)}
      </nav>
    </div>
  </div>;
}
