import { safeSource } from "../presentation";

export function SourceLink({ url, children }: { url: string; children: React.ReactNode }) {
  const href = safeSource(url);
  return href ? <a className="text-link" href={href}>{children}</a> : <span>{children}</span>;
}
