import { company } from "./company";

const linkClass = "underline-offset-4 hover:text-foreground hover:underline";

/** Footer links to the legal pages and the source code. */
export function LegalLinks({ sourceLabel = "Quellcode" }: { sourceLabel?: string }) {
  return (
    <nav className="flex flex-wrap gap-x-4 gap-y-1">
      <a href="/impressum" className={linkClass}>
        Impressum
      </a>
      <a href="/datenschutz" className={linkClass}>
        Datenschutz
      </a>
      <a href={company.sourceUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
        {sourceLabel}
      </a>
    </nav>
  );
}
