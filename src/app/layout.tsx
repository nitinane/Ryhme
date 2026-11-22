import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Navigation } from "@/components/navigation";
import { SelectionProvider } from "@/features/comparison/components/selection";
import "./globals.css";

const title = "Rhyme | AI model discovery";
const description = "Rhyme brings AI model specifications, benchmarks, and provider options together so you can compare them with sources.";

export const metadata: Metadata = {
  title,
  description,
  applicationName: "Rhyme",
  openGraph: { type: "website", siteName: "Rhyme", title, description },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>
    <SelectionProvider>
      <Navigation />
      {children}
      <footer className="frame site-footer py-6 text-sm muted">Rhyme</footer>
    </SelectionProvider>
  </body></html>;
}
