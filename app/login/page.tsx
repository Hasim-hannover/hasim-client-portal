import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  FolderKanban,
  Headphones,
  LockKeyhole,
  Mail,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
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
      <div className={styles.paperGlow} aria-hidden="true" />
      <div className={styles.architecture} aria-hidden="true">
        <div className={styles.architectureLines} />
        <span className={styles.architectureLabel}>Projekte · Menschen · Fortschritt</span>
      </div>
      <p className={styles.topMotto} aria-hidden="true">Projekte schaffen Klarheit.</p>

      <div className={styles.layout}>
        <section className={styles.brandPanel} aria-labelledby="werk-intro-title">
          <div className={styles.wordmark} aria-label="WERK Klientenportal">
            <span className={styles.wordmarkMain}>WERK</span>
            <span className={styles.wordmarkSub}>Klientenportal</span>
          </div>

          <div className={styles.brandCopy}>
            <p className={styles.eyebrow}>Effizient. Transparent. Gemeinsam.</p>
            <h1 id="werk-intro-title">Projekte. Klar organisiert.</h1>
            <p className={styles.intro}>
              WERK ist mein eigenentwickeltes Kundenportal für die Zusammenarbeit in laufenden Projekten.
              Dokumente, Kommunikation, Freigaben und Projektfortschritt bleiben an einem zentralen Ort nachvollziehbar.
            </p>
          </div>

          <div className={styles.features} aria-label="Funktionen des WERK Klientenportals">
            {benefits.map(({ title, text, Icon }) => (
              <article className={styles.feature} key={title}>
                <div className={styles.featureIcon} aria-hidden="true">
                  <Icon />
                </div>
                <div className={styles.featureCopy}>
                  <h2>{title}</h2>
                  <p>{text}</p>
                </div>
                <ArrowRight className={styles.featureArrow} aria-hidden="true" />
              </article>
            ))}
          </div>

          <div className={styles.signature}>
            <span className={styles.signatureLine} aria-hidden="true" />
            <p>
              <strong>Entwickelt von Hasim Üner</strong>
              <span>Für die strukturierte Zusammenarbeit mit meinen Kund:innen.</span>
            </p>
          </div>
        </section>

        <section className={styles.loginCard} aria-labelledby="login-title">
          <div className={styles.cardGlow} aria-hidden="true" />

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
              <div className={styles.inputShell}>
                <Mail aria-hidden="true" />
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
            </div>

            <div className={styles.field}>
              <label htmlFor="login-password">Passwort</label>
              <div className={styles.inputShell}>
                <LockKeyhole aria-hidden="true" />
                <input
                  id="login-password"
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  placeholder="Passwort eingeben"
                  required
                />
              </div>
            </div>

            <div className={styles.passwordHelp}>
              <Link href="/forgot-password">Passwort vergessen?</Link>
            </div>

            {error ? <div className={styles.error} role="alert">{error}</div> : null}

            <button className={styles.submit} type="submit">
              <span>Anmelden</span>
              <ArrowRight aria-hidden="true" />
            </button>
          </form>

          <footer className={styles.cardFooter}>
            <p className={styles.support}>
              <Headphones aria-hidden="true" />
              <span>Probleme mit deinem Zugang? <a href="mailto:hallo@hasimuener.de">hallo@hasimuener.de</a></span>
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
