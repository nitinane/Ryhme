"use client";

import Form from "next/form";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ComparisonLink } from "@/features/comparison/components/selection";

type SearchResult = { id: string; name: string; slug: string };

export function Navigation() {
  const path = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{ query: string; models: SearchResult[] | null }>();

  useEffect(() => {
    function openOnShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        open();
      }
    }
    window.addEventListener("keydown", openOnShortcut);
    return () => window.removeEventListener("keydown", openOnShortcut);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, limit: "5" });
        const response = await fetch(`/api/models?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Search unavailable");
        const { data } = await response.json();
        setResult({ query, models: data });
      } catch {
        if (!controller.signal.aborted) setResult({ query, models: null });
      }
    }, 280);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  function open() {
    if (!dialog.current || dialog.current.open) return;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery("");
    setResult(undefined);
    dialog.current.showModal();
    input.current?.focus();
  }

  return (
    <header className="site-header">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <nav className="frame nav" aria-label="Main navigation">
        <Link href="/" className="brand"><span className="brand-mark" aria-hidden="true">✦</span>Ryhme</Link>
        <div className="nav-actions">
          <Link href="/models" aria-current={path.startsWith("/models") ? "page" : undefined}>Catalog</Link>
          <ComparisonLink active={path === "/compare"} />
          <Link href="/rankings" aria-current={path === "/rankings" ? "page" : undefined}>Rankings</Link>
          <Link href="/labs" aria-current={path.startsWith("/labs") ? "page" : undefined}>Labs</Link>
          <Link href="/providers" aria-current={path.startsWith("/providers") ? "page" : undefined}>Providers</Link>
          <button className="button search-trigger" type="button" onClick={open}>
            Search <kbd className="hidden sm:inline">Ctrl K</kbd>
          </button>
        </div>
      </nav>
      <dialog className="search-dialog" ref={dialog} aria-labelledby="global-search-title" onClose={() => {
        if (!dialog.current?.open) opener.current?.focus();
      }}>
        <div className="flex items-center justify-between gap-4">
          <h2 id="global-search-title" className="text-xl font-semibold">Search models</h2>
          <button className="button" type="button" onClick={() => dialog.current?.close()}>Close</button>
        </div>
        <Form action="/models" className="mt-4 flex gap-2" onSubmit={() => dialog.current?.close()}>
          <input ref={input} name="q" type="search" aria-label="Search by model name" placeholder="Search by model name" maxLength={120}
            value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1" />
          <button className="button primary" type="submit">Search</button>
        </Form>
        {query.trim().length >= 2 && (
          <div className="mt-4 text-sm">
            {!result || result.query !== query ? <p role="status">Searching…</p>
              : result.models === null ? <p role="status">Search temporarily unavailable.</p>
              : result.models.length === 0 ? <p role="status">No matching models.</p>
              : <ul className="grid gap-1">{result.models.map((model) => (
                <li key={model.id}><Link className="search-result" href={`/models/${model.slug}`} onClick={() => dialog.current?.close()}>{model.name}</Link></li>
              ))}</ul>}
          </div>
        )}
      </dialog>
    </header>
  );
}
