import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Impressum",
  description: "Anbieterkennzeichnung für das Hasim Client Portal.",
};

export default function ImpressumPage() {
  return (
    <main className="legal-shell" id="main-content">
      <article className="legal-page">
        <header>
          <span className="legal-kicker">Rechtliches · Client Portal</span>
          <h1>Impressum</h1>
          <p className="lead">Anbieterkennzeichnung für das Hasim Client Portal.</p>
          <p className="legal-meta">Stand: 8. September 2026</p>
        </header>

        <h2>Anbieter</h2>
        <p><strong>Haşim Üner</strong><br />Pattensen bei Hannover<br />Deutschland</p>

        <h2>Kontakt</h2>
        <p>E-Mail: <a href="mailto:kontakt@hasimuener.de">kontakt@hasimuener.de</a><br />Telefon: <a href="tel:+4917676596580">+49 176 76596580</a></p>

        <div className="legal-callout">
          <strong>Vollständige zentrale Anbieterkennzeichnung</strong>
          <p>Die vollständige geschäftliche Anbieterkennzeichnung einschließlich der jeweils aktuellen ladungsfähigen Anschrift und weiterer gesetzlich erforderlicher Angaben wird zentral auf der Hauptwebsite gepflegt.</p>
          <p><a href="https://hasimuener.de/impressum/" rel="noreferrer">Zentrales Impressum auf hasimuener.de öffnen</a></p>
        </div>

        <h2>Verantwortlich für Inhalte</h2>
        <p>Haşim Üner, Anschrift wie in der zentralen Anbieterkennzeichnung.</p>

        <h2>Hinweis zum Kundenportal</h2>
        <p>Dieses Portal ist kein öffentliches Informations- oder Verkaufsportal. Es dient ausschließlich der geschützten Projektkommunikation, dem Dateiaustausch und der Zusammenarbeit mit bestehenden oder konkret angebahnten Kunden.</p>

        <div className="legal-actions">
          <a href="mailto:kontakt@hasimuener.de">Kontakt aufnehmen</a>
          <Link href="/datenschutz">Datenschutz</Link>
          <Link href="/login">Zum Portal</Link>
        </div>
      </article>
    </main>
  );
}
