"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

const ChartSelection = createContext<{
  selectedSlug: string | undefined;
  select: (slug: string) => void;
} | null>(null);

export function ChartSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedSlug, setSelectedSlug] = useState<string>();
  const select = (slug: string) => setSelectedSlug(current => current === slug ? undefined : slug);
  return <ChartSelection.Provider value={{ selectedSlug, select }}>{children}</ChartSelection.Provider>;
}

export function useChartSelection() {
  const selection = useContext(ChartSelection);
  if (!selection) throw new Error("Benchmark charts require a selection provider.");
  return selection;
}
