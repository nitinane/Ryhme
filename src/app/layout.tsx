import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Navigation } from "@/components/navigation";
import { SelectionProvider } from "@/features/comparison/components/selection";
import "./globals.css";

const title = "Ryhme | AI model discovery";
const description = "Ryhme brings AI model specifications, benchmarks, and provider options together so you can compare them with sources.";

export const metadata: Metadata = {
  title,
  description,
  applicationName: "Ryhme",
  openGraph: { type: "website", siteName: "Ryhme", title, description },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>
    <SelectionProvider>
      <Navigation />
      {children}
      <footer className="frame site-footer py-6 text-sm muted">Ryhme</footer>
    </SelectionProvider>
  </body></html>;
}
