# Privacy & GDPR Readiness – Hasim Client Portal

Stand: 8. September 2026

Dieses Dokument ist die technische Datenschutz-Checkliste des Portals. Es ersetzt keine individuelle Rechtsberatung.

## Im Produkt umgesetzt

- Portal und Admin sind `noindex`/`noarchive`.
- Geschützte Seiten und APIs werden mit `Cache-Control: private, no-store` ausgeliefert.
- Content Security Policy sowie zusätzliche Security Header sind gesetzt.
- Rollen- und projektbezogene Autorisierung erfolgt serverseitig und über Supabase Row Level Security.
- Kunden können nicht auf Admin-Bereiche oder Daten anderer Kunden zugreifen.
- Projektdateien liegen in einem privaten Supabase-Storage-Bucket; Downloads erfolgen über kurzlebige Signed URLs.
- Uploads sind auf 100 MB pro Datei und eine serverseitige MIME-Allowlist begrenzt.
- Es sind keine Marketing-, Analytics- oder Profiling-Tracker im Portal eingebaut.
- Nur technisch notwendige Authentifizierungs-/Sitzungsdaten werden verwendet; daher ist kein Consent-Banner für optionale Tracking-Technologien erforderlich.
- Transaktions-E-Mails laufen über Brevo; personenbezogenes Pixel-/Klicktracking wird pro Empfänger deaktiviert.
- Vertrauliche Nachrichteninhalte, Dateinamen, Upload-Notizen und Dateiinhalte werden nicht in Benachrichtigungs-E-Mails gespiegelt.
- Portal-spezifische Datenschutzhinweise und Impressum sind auf jeder Seite erreichbar.
- Datenschutzanfragen können direkt über `kontakt@hasimuener.de` gestellt werden.

## Organisatorische Produktions-Gates

Vor dem produktiven Einsatz mit realen Kundendaten müssen zusätzlich folgende Punkte dokumentiert bzw. abgeschlossen sein:

1. **Vercel kommerzieller Tarif:** Kein Hobby-Tarif für kommerziellen Produktivbetrieb. Einen geschäftlich zulässigen Tarif (z. B. Pro) nutzen, DPA prüfen/abschließen und AI-/Training-Datennutzung in den Account-Einstellungen deaktiviert halten.
2. **Supabase:** DPA/Subprocessor-Liste dokumentieren, EU-Region beibehalten und `Leaked Password Protection` aktivieren.
3. **Brevo:** DPA/Subprocessor-Liste dokumentieren; Öffnungs-/Klicktracking für Portal-Transaktionsmails deaktiviert halten.
4. **GitHub:** Repository vor echtem Kundeneinsatz privat stellen, auch wenn keine Secrets im Repository liegen.
5. **Lösch- und Aufbewahrungskonzept:** Konkrete Fristen je Datenkategorie festlegen (Projektunterlagen, Nachrichten, Versandlogs, Auth-Konten, Backups) und in das interne Verzeichnis von Verarbeitungstätigkeiten übernehmen.
6. **AV-Verträge / Verzeichnis der Verarbeitungstätigkeiten:** Supabase, Vercel und Brevo sowie Zweck, Kategorien, Empfänger, Rechtsgrundlagen und Löschfristen dokumentieren.
7. **TOMs:** Zugriffsmanagement, Passwort-/MFA-Regeln, Backup/Restore, Incident-Prozess, Berechtigungsreview und Geräte-/Admin-Sicherheit schriftlich dokumentieren.
8. **Betroffenenrechte:** Interner Ablauf für Auskunft, Export, Berichtigung, Löschung, Einschränkung und Identitätsprüfung festlegen.
9. **Datenschutzverletzungen:** Incident-Runbook mit Bewertung der 72-Stunden-Meldepflicht nach Art. 33 DSGVO festlegen.
10. **Rechtstexte:** Anbieterangaben und Datenschutzhinweise bei Änderungen an Hosting, Domain, Dienstleistern oder Funktionen synchron aktualisieren.

## Datenminimierungsregel für Kommunikation

E-Mail ist nur der Benachrichtigungskanal. Projektinhalte gehören in das authentifizierte Portal. Deshalb sollen E-Mails grundsätzlich nur enthalten:

- Projektbezug,
- Art des Ereignisses,
- Anzahl/Typ von Dateien oder Aufgabe,
- sicheren Link zurück ins Portal.

Keine vertraulichen Nachrichtentexte, Datei-Inhalte, Upload-Notizen oder unnötigen personenbezogenen Daten per E-Mail versenden.

## Regelmäßige Prüfungen

- Supabase Security Advisor nach Schema-/RLS-Änderungen prüfen.
- Abhängigkeiten und Security Header bei Next.js-/Supabase-Upgrades prüfen.
- Dienstleister-DPAs und Subprocessor-Listen mindestens jährlich bzw. bei Anbieteränderungen kontrollieren.
- Kunden- und Admin-Berechtigungen regelmäßig überprüfen.
- Datenschutzhinweise nach jeder wesentlichen Funktionsänderung aktualisieren.
