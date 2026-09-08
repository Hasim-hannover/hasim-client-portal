import Link from "next/link";

export function LegalFooter() {
  return (
    <footer className="legal-footer" aria-label="Rechtliche Hinweise">
      <div className="legal-footer-inner">
        <span>Hasim Client Portal · geschützter Projektraum</span>
        <nav aria-label="Rechtliches">
          <Link href="/datenschutz">Datenschutz</Link>
          <Link href="/impressum">Impressum</Link>
          <a href="mailto:kontakt@hasimuener.de">Datenschutzkontakt</a>
        </nav>
      </div>
    </footer>
  );
}
