import Link from "next/link";
import { CheckCircle2, FileText, FolderKanban, MessageSquare, ShieldCheck } from "lucide-react";
import { login } from "./actions";
import styles from "./login.module.css";

const benefits = [
  {
    title: "Sichere Kommunikation",
    text: "Projektbezogene Abstimmungen zentral statt verteilt über verschiedene Kanäle.",
    Icon: MessageSquare,
  },
  {
    title: "Dokumente & Dateien",
    text: "Unterlagen bereitstellen und projektbezogen austauschen.",
    Icon: FileText,
  },
  {
    title: "Projektphasen im Blick",
    text: "Fortschritt, nächste Schritte und offene Punkte jederzeit nachvollziehen.",
    Icon: FolderKanban,
  },
  {
    title: "Freigaben dokumentiert",
    text: "Änderungen, Entscheidungen und Freigaben bleiben dem Projekt zugeordnet.",
    Icon: CheckCircle2,
  },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[]; message?: string | string[] }>;
}) {
  const query = await searchParams;
  const error = Array.isArray(query.error) ? query.error[0] : query.error;
  const message = Array.isArray(query.message) ? query.message[0] : query.message;

  return (
    <main className={styles.shell} id="main-content">
      <div className={styles.ambient} aria-hidden="true" />

      <div className={styles.layout}>
        <section className={styles.brandPanel} aria-labelledby="werk-intro-title">
          <div className={styles.wordmark} aria-label="WERK Klientenportal">
            <span className={styles.wordmarkMain}>WERK</span>
            <span className={styles.wordmarkSub}>Klientenportal</span>
          </div>

          <div className={styles.brandCopy}>
            <p className={styles.eyebrow}>Projektarbeit ohne Informationsverlust</p>
            <h1 id="werk-intro-title">Projekte. Klar organisiert.</h1>
            <p className={styles.intro}>
              WERK ist mein eigenentwickeltes Kundenportal für die Zusammenarbeit in laufenden Projekten.
              Dokumente, Kommunikation, Freigaben und Projektfortschritt bleiben an einem zentralen Ort nachvollziehbar.
            </p>
          </div>

          <div className={styles.features} aria-label="Funktionen des WERK Klientenportals">
            {benefits.map(({ title, text, Icon }, index) => (
              <article className={styles.feature} key={title}>
                <div className={styles.featureTopline}>
                  <span className={styles.featureIndex}>{String(index + 1).padStart(2, "0")}</span>
                  <div className={styles.featureIcon} aria-hidden="true">
                    <Icon />
                  </div>
                </div>
                <h2>{title}</h2>
                <p>{text}</p>
              </article>
            ))}
          </div>

          <p className={styles.signature}>
            <span aria-hidden="true" />
            Entwickelt von Hasim Üner für die strukturierte Zusammenarbeit mit meinen Kund:innen.
          </p>
        </section>

        <section className={styles.loginCard} aria-labelledby="login-title">
          <div className={styles.cardTopline} aria-hidden="true" />

          <div className={styles.cardMeta}>
            <span>WERK / PROJEKTZUGANG</span>
            <span className={styles.securityBadge}><ShieldCheck /> Geschützter Bereich</span>
          </div>

          <div className={styles.cardHeading}>
            <h2 id="login-title">Projektzugang</h2>
            <p className={styles.cardLead}>Für bestehende Kund:innen.</p>
          </div>

          {message ? <div className={styles.success} role="status">{message}</div> : null}

          <form action={login} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="login-email">E-Mail</label>
              <input
                id="login-email"
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                placeholder="name@beispiel.de"
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="login-password">Passwort</label>
              <input
                id="login-password"
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="Passwort eingeben"
                required
              />
            </div>

            <div className={styles.passwordHelp}>
              <Link href="/forgot-password">Passwort vergessen?</Link>
            </div>

            {error ? <div className={styles.error} role="alert">{error}</div> : null}

            <button className={styles.submit} type="submit">
              <span>Anmelden</span>
              <span className={styles.submitArrow} aria-hidden="true">→</span>
            </button>
          </form>

          <footer className={styles.cardFooter}>
            <p className={styles.support}>
              Probleme mit deinem Zugang? <a href="mailto:hallo@hasimuener.de">hallo@hasimuener.de</a>
            </p>
            <p className={styles.privacy}>
              Für die Anmeldung werden nur technisch notwendige Sitzungs- und Sicherheitsdaten verwendet.{" "}
              <Link href="/datenschutz">Datenschutzhinweise</Link>
            </p>
          </footer>
        </section>
      </div>
    </main>
  );
}
