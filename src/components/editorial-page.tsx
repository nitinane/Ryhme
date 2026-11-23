import type { ReactNode } from "react";
import Form from "next/form";

export function PageShell({ children }: { children: ReactNode }) {
  return <main id="main-content" tabIndex={-1} className="frame page">{children}</main>;
}

export function EditorialSearch({ action = "/models", label = "Search model catalog", placeholder = label, button = "Find models", query, children }: {
  action?: string; label?: string; placeholder?: string; button?: string; query?: string; children?: ReactNode;
}) {
  return <Form action={action} className="home-search">
    {children}
    <input name="q" type="search" aria-label={label} placeholder={placeholder} defaultValue={query} maxLength={120} />
    <button type="submit" className="button primary">{button}</button>
  </Form>;
}

export function PageHeading({ title, accent, label, children, tools }: {
  title: string; accent?: string; label?: ReactNode; children?: ReactNode; tools?: ReactNode;
}) {
  return <header className="studio-intro">
    <div className="studio-editorial">
      {label && <p className="studio-label">{label}</p>}
      <h1>{title}{accent && <> <em>{accent}</em></>}</h1>
      {children}
    </div>
    {tools && <div className="home-tools editorial-tools">{tools}</div>}
  </header>;
}

export function EditorialWorkspace({ title, children, aside }: {
  title: string; children: ReactNode; aside: ReactNode;
}) {
  return <div className="studio-analysis editorial-workspace">
    <section className="studio-board">
      <header className="studio-section-head"><h2>{title}</h2></header>
      {children}
    </section>
    <aside className="studio-side">{aside}</aside>
  </div>;
}

export function LoadingPage({ children }: { children: ReactNode }) {
  return <PageShell><p className="panel muted" role="status">{children}</p></PageShell>;
}

export function PageNotice({ title, message, alert, children }: {
  title: string; message: string; alert?: boolean; children: ReactNode;
}) {
  return <PageShell>
    <PageHeading title={title}><p role={alert ? "alert" : undefined}>{message}</p></PageHeading>
    {children}
  </PageShell>;
}
