"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";

type Candidate = { id: string; name: string };
type Selection = { items: Candidate[]; toggle: (item: Candidate) => void; setItems: (items: Candidate[]) => void };
const SelectionContext = createContext<Selection | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Candidate[]>([]);
  const path = usePathname();

  function toggle(item: Candidate) {
    setItems((current) => current.some(({ id }) => id === item.id) ? current.filter(({ id }) => id !== item.id)
      : current.length < 4 ? [...current, item] : current);
  }

  return (
    <SelectionContext value={{ items, toggle, setItems }}>
      {children}
      {items.length > 0 && path !== "/compare" && (
        <aside className="compare-tray" aria-label="Comparison selection">
          <div className="frame flex flex-wrap items-center justify-between gap-3">
            <p aria-live="polite"><strong>{items.length} of 4 selected</strong> <span className="muted hidden sm:inline">{items.map(({ name }) => name).join(", ")}</span></p>
            <div className="flex gap-2">
              <button type="button" className="button" onClick={() => setItems([])}>Clear</button>
              {items.length >= 2
                ? <Link className="button primary" href={`/compare?models=${items.map(({ id }) => id).join(",")}`}>Compare selected</Link>
                : <button type="button" className="button primary" disabled>Compare selected</button>}
            </div>
          </div>
        </aside>
      )}
    </SelectionContext>
  );
}

export function CompareToggle({ id, name }: Candidate) {
  const selection = useContext(SelectionContext);
  if (!selection) return null;
  const checked = selection.items.some((item) => item.id === id);
  return (
    <label className="compare-toggle">
      <input type="checkbox" checked={checked} disabled={!checked && selection.items.length >= 4}
        onChange={() => selection.toggle({ id, name })} aria-label={`Compare ${name}`} />
      Compare
    </label>
  );
}

export function BrowseForComparison({ models }: { models: Candidate[] }) {
  const selection = useContext(SelectionContext);
  return (
    <Link className="button" href="/models" onClick={() => selection?.setItems(models)}>Edit in catalog</Link>
  );
}

export function ComparisonLink({ active }: { active: boolean }) {
  const items = useContext(SelectionContext)?.items ?? [];
  const href = items.length >= 2 ? `/compare?models=${items.map(({ id }) => id).join(",")}` : "/compare";
  return <Link href={href} aria-current={active ? "page" : undefined}>Compare</Link>;
}
