import { safeSource } from "../presentation";

export function SourceLink({ url, children }: { url: string; children: React.ReactNode }) {
  const href = safeSource(url);
  return href ? <a className="text-link source-label" href={href}>{children}</a> : <span className="source-label">{children}</span>;
}
