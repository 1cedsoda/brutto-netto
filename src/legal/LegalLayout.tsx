import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { ArrowLeft } from "lucide-react";
import "../styles/global.css";
import { LegalLinks } from "./LegalLinks";

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-8 mb-2 text-lg font-semibold tracking-tight">{children}</h2>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className="mb-3 leading-relaxed text-muted-foreground">{children}</p>;
}

export function Address({ lines }: { lines: readonly string[] }) {
  return (
    <address className="mb-3 not-italic leading-relaxed text-muted-foreground">
      {lines.map((line) => (
        <span key={line} className="block">
          {line}
        </span>
      ))}
    </address>
  );
}

export function A({ href, children }: { href: string; children: ReactNode }) {
  const external = /^https?:/.test(href);
  return (
    <a
      href={href}
      className="font-medium text-foreground underline underline-offset-4"
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </a>
  );
}

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background text-foreground antialiased">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 text-sm sm:py-10">
        <a
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Zum Brutto-Netto-Rechner
        </a>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <div className="mt-4">{children}</div>
        <footer className="mt-10 border-t pt-4 text-xs text-muted-foreground">
          <LegalLinks />
        </footer>
      </div>
    </main>
  );
}

export function renderLegalPage(title: string, content: ReactNode) {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <LegalLayout title={title}>{content}</LegalLayout>
    </StrictMode>,
  );
}
