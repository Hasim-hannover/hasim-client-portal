import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Datenschutz",
  description: "Datenschutzhinweise für das Hasim Client Portal.",
};

export default function DatenschutzPage() {
  return (
    <main className="legal-shell" id="main-content">
      <article className="legal-page">
        <header>
          <span className="legal-kicker">Datenschutz · Client Portal</span>
          <h1>Datenschutzhinweise</h1>
          <p className="lead">Diese Hinweise erklären transparent, welche personenbezogenen Daten im geschützten Kundenportal verarbeitet werden, wofür sie benötigt werden und welche Rechte du hast.</p>
          <p className="legal-meta">Stand: 8. September 2026</p>
        </header>

        <div className="legal-callout">
          <strong>Privacy by default</strong>
          <p>Das Portal ist nicht öffentlich indexierbar, verwendet keine Werbe- oder Analyse-Tracker und setzt nur technisch notwendige Authentifizierungs- und Sicherheitsmechanismen ein. Projektdateien liegen in einem privaten Speicherbereich und werden nur über zeitlich begrenzte Zugriffslinks bereitgestellt.</p>
        </div>

        <h2>1. Verantwortlicher</h2>
        <p>Verantwortlich für die Datenverarbeitung in diesem Portal ist Haşim Üner. Datenschutzanfragen können direkt an <a href="mailto:kontakt@hasimuener.de">kontakt@hasimuener.de</a> gerichtet werden. Die vollständige Anbieterkennzeichnung findest du im <Link href="/impressum">Impressum</Link>.</p>

        <h2>2. Zweck des Portals</h2>
        <p>Das Portal dient ausschließlich der Durchführung und Organisation von Kundenprojekten. Dazu gehören insbesondere Zugangskontrolle, Projektstatus, Aufgaben und Freigaben, sichere Dateiübertragung, projektbezogene Nachrichten sowie technisch notwendige Benachrichtigungen.</p>

        <h2>3. Welche Daten verarbeitet werden</h2>
        <div className="legal-table">
          <div><strong>Stamm- und Kontaktdaten</strong><span>Name, Unternehmen, E-Mail-Adresse, Telefonnummer, Kundennummer.</span></div>
          <div><strong>Zugangsdaten</strong><span>Benutzerkonto, Authentifizierungsinformationen, Sitzungsdaten und Passwort-Reset-Vorgänge. Passwörter werden nicht im Klartext gespeichert.</span></div>
          <div><strong>Projektdaten</strong><span>Projektname, Status, Projektphase, Aufgaben, Anforderungen, Freigaben, Antworten und Zeitstempel.</span></div>
          <div><strong>Kommunikation</strong><span>Projektbezogene Nachrichten und Notizen, die du oder der Administrator im Portal hinterlegen.</span></div>
          <div><strong>Dateien</strong><span>Hochgeladene Dokumente, Bilder, Videos und sonstige Projektdateien einschließlich Dateiname, Dateityp, Dateigröße und Zuordnung zum Projekt.</span></div>
          <div><strong>Benachrichtigungsdaten</strong><span>Portal-Benachrichtigungen sowie Versandstatus technisch notwendiger Transaktions-E-Mails.</span></div>
          <div><strong>Technische Daten</strong><span>IP-Adresse, Zeitpunkt des Zugriffs, Browser-/Geräteinformationen und technische Protokolldaten, soweit sie für Betrieb, Sicherheit, Fehleranalyse und Missbrauchsschutz anfallen.</span></div>
        </div>

        <h2>4. Rechtsgrundlagen</h2>
        <p>Die Verarbeitung projektbezogener Daten erfolgt grundsätzlich zur Durchführung vorvertraglicher Maßnahmen oder eines Vertrags gemäß Art. 6 Abs. 1 lit. b DSGVO. Soweit gesetzliche Pflichten bestehen, beruht die Verarbeitung auf Art. 6 Abs. 1 lit. c DSGVO. Sicherheits-, Missbrauchsschutz- und technisch notwendige Betriebsdaten können auf Art. 6 Abs. 1 lit. f DSGVO gestützt werden; das berechtigte Interesse liegt im sicheren, stabilen und nachvollziehbaren Betrieb des Kundenportals.</p>
        <p>Transaktions-E-Mails zu Zugang, Projektstatus, Nachrichten, Uploads oder Freigaben sind funktionaler Bestandteil der Projektkommunikation und keine Marketing-E-Mails.</p>

        <h2>5. Technisch notwendige Cookies und Sitzungsspeicherung</h2>
        <p>Für Anmeldung und Sitzung verwendet das Portal ausschließlich technisch notwendige Authentifizierungsinformationen. Sie sind erforderlich, damit der ausdrücklich gewünschte geschützte Dienst bereitgestellt werden kann. Es werden keine Marketing-, Profiling- oder Webanalyse-Cookies eingesetzt.</p>
        <p>Soweit Informationen auf deinem Endgerät gespeichert oder ausgelesen werden, geschieht dies für die technisch notwendige Bereitstellung des Portals. Für solche unbedingt erforderlichen Vorgänge ist nach § 25 Abs. 2 Nr. 2 TDDDG keine Einwilligung erforderlich.</p>

        <h2>6. Auftragsverarbeiter und technische Dienstleister</h2>
        <h3>Supabase</h3>
        <p>Supabase wird für Authentifizierung, Datenbank, Realtime-Funktionen und privaten Dateispeicher eingesetzt. Das Projekt ist in der Region EU West (Irland) angelegt. Supabase verarbeitet Kundendaten im Rahmen der vereinbarten Auftragsverarbeitung; für eigene Nutzungs- und Abrechnungsdaten kann Supabase selbst Verantwortlicher sein.</p>

        <h3>Vercel</h3>
        <p>Vercel stellt die Webanwendung und Serverfunktionen bereit. Beim Aufruf fallen technisch notwendige Verbindungs- und Bereitstellungsdaten an. Soweit personenbezogene Kundendaten im Rahmen des Hostings verarbeitet werden, erfolgt dies nach den für den eingesetzten Tarif geltenden Datenschutz- und Auftragsverarbeitungsbedingungen.</p>

        <h3>Brevo</h3>
        <p>Brevo wird ausschließlich für technisch notwendige Transaktions-E-Mails verwendet. Übermittelt werden die für den jeweiligen Versand erforderliche E-Mail-Adresse und ein auf den Zweck begrenzter Nachrichteninhalt. Marketingkampagnen sind nicht Bestandteil des Portals. Für E-Mails wird auf personenbezogenes Öffnungs- und Klicktracking verzichtet.</p>

        <h2>7. Drittlandübermittlungen</h2>
        <p>Einzelne Dienstleister oder deren Unterauftragsverarbeiter können ihren Sitz außerhalb des Europäischen Wirtschaftsraums haben. Soweit dadurch eine Drittlandübermittlung stattfindet, erfolgt sie nur auf Grundlage der Voraussetzungen der Art. 44 ff. DSGVO, insbesondere eines Angemessenheitsbeschlusses oder geeigneter Garantien wie EU-Standardvertragsklauseln.</p>

        <h2>8. Speicherdauer und Löschung</h2>
        <p>Personenbezogene Daten werden nur so lange gespeichert, wie sie für die Durchführung des Projekts, die sichere Bereitstellung des Kundenkontos, die Bearbeitung von Ansprüchen oder gesetzliche Aufbewahrungspflichten benötigt werden. Nach Wegfall des Zwecks werden Daten gelöscht oder gesperrt, soweit keine gesetzlichen oder vertraglichen Gründe für eine weitere Speicherung bestehen.</p>
        <p>Portal-Benachrichtigungen, Versandprotokolle und technische Betriebsdaten werden nach dem Grundsatz der Datenminimierung nur so lange vorgehalten, wie dies für Nachvollziehbarkeit, Fehleranalyse oder Sicherheit erforderlich ist. Projektdateien werden nicht öffentlich bereitgestellt.</p>

        <h2>9. Empfänger</h2>
        <p>Innerhalb des Projekts erhalten nur berechtigte Personen Zugriff. Kundenkonten sind voneinander getrennt; ein Kunde kann keine Daten anderer Kunden oder den Administratorbereich einsehen. Eine Weitergabe an weitere Empfänger erfolgt nur, wenn sie zur Vertragserfüllung erforderlich, gesetzlich vorgeschrieben oder anderweitig datenschutzrechtlich zulässig ist.</p>

        <h2>10. Sicherheit</h2>
        <p>Das Portal setzt technische und organisatorische Schutzmaßnahmen ein. Dazu gehören verschlüsselte Übertragung per HTTPS, rollenbasierte Zugriffsrechte, Row Level Security in der Datenbank, private Dateispeicherung, zeitlich begrenzte Download-Links, getrennte Administrator- und Kundenrechte, Sicherheitsheader, No-Index-Vorgaben sowie serverseitige Autorisierungsprüfungen.</p>
        <p>Trotz sorgfältiger Absicherung kann kein internetbasierter Dienst absolute Sicherheit garantieren. Sicherheitsmaßnahmen werden deshalb fortlaufend überprüft und dem Risiko angepasst.</p>

        <h2>11. Deine Rechte</h2>
        <p>Du hast im Rahmen der gesetzlichen Voraussetzungen insbesondere das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Wenn eine Verarbeitung ausnahmsweise auf einer Einwilligung beruht, kannst du diese mit Wirkung für die Zukunft widerrufen.</p>
        <p>Für die Ausübung deiner Rechte genügt eine Nachricht an <a href="mailto:kontakt@hasimuener.de?subject=Datenschutzanfrage%20Client%20Portal">kontakt@hasimuener.de</a>. Zur Vermeidung unberechtigter Auskünfte kann eine angemessene Identitätsprüfung erforderlich sein.</p>

        <h2>12. Beschwerderecht</h2>
        <p>Du hast das Recht, dich bei einer Datenschutzaufsichtsbehörde zu beschweren. Zuständig ist insbesondere die Aufsichtsbehörde des Bundeslandes, in dem der Verantwortliche seinen Sitz hat; du kannst dich grundsätzlich auch an die Aufsichtsbehörde deines Aufenthaltsorts wenden.</p>

        <h2>13. Keine automatisierte Entscheidung</h2>
        <p>Im Portal findet keine ausschließlich automatisierte Entscheidungsfindung einschließlich Profiling im Sinne von Art. 22 DSGVO statt.</p>

        <h2>14. Änderungen dieser Hinweise</h2>
        <p>Diese Datenschutzhinweise werden angepasst, wenn sich Funktionen, Dienstleister oder rechtliche Anforderungen wesentlich ändern. Die jeweils aktuelle Fassung ist dauerhaft über den Link „Datenschutz“ im Portal erreichbar.</p>

        <div className="legal-actions">
          <a href="mailto:kontakt@hasimuener.de?subject=Datenschutzanfrage%20Client%20Portal">Datenschutzanfrage senden</a>
          <Link href="/login">Zum Portal</Link>
          <Link href="/impressum">Impressum</Link>
        </div>
      </article>
    </main>
  );
}
