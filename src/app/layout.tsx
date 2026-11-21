import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Navigation } from "@/components/navigation";
import { SelectionProvider } from "@/features/comparison/components/selection";
import "./globals.css";

export const metadata: Metadata = {
  title: "OneAtlas | AI model discovery",
  description: "Explore AI model specifications, benchmarks, and provider options.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>
    <SelectionProvider><Navigation />{children}</SelectionProvider>
  </body></html>;
}
