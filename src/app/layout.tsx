import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Navigation } from "@/components/navigation";
import { SelectionProvider } from "@/features/comparison/components/selection";
import "./globals.css";
import "./studio.css";

const title = "Rhyme | AI model discovery";
const description = "Rhyme brings AI model specifications, benchmarks, and provider options together so you can compare them with sources.";

export const metadata: Metadata = {
  title,
  description,
  applicationName: "Rhyme",
  openGraph: { type: "website", siteName: "Rhyme", title, description },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const database = URL.parse(process.env.DATABASE_URL ?? "");
  const fixturePreview = !process.env.VERCEL && database?.hostname === "127.0.0.1"
    && database.pathname === "/ryhme_m113";
  return <html lang="en"><body>
    <SelectionProvider>
      {fixturePreview && <p className="frame py-2 text-center text-sm muted">Local preview · Synthetic test data</p>}
      <Navigation />
      {children}
      <footer className="frame site-footer py-6 text-sm muted">Rhyme</footer>
    </SelectionProvider>
  </body></html>;
}
