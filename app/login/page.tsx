import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PrivacyContent } from "../datenschutz/privacy-content";
import { login } from "./actions";
import { PrivacyDialog } from "./privacy-dialog";
import styles from "./login.module.css";

const points = ["Dateien", "Abstimmungen", "Freigaben"];

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
            <p className={styles.eyebrow}>Projektzugang</p>
            <h1 id="werk-intro-title">
              Klar rein.
              <span>Klar weiter.</span>
            </h1>
            <p className={styles.intro}>Ein zentraler Zugang für laufende Projekte.</p>
          </div>

          <ul className={styles.points} aria-label="Bereiche im Klientenportal">
            {points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>

          <p className={styles.signature}>Entwickelt von Hasim Üner</p>
        </section>

        <section className={styles.loginCard} aria-labelledby="login-title">
          <div className={styles.cardMeta}>WERK / LOGIN</div>

          <div className={styles.cardHeading}>
            <h2 id="login-title">Anmelden</h2>
            <p>Für Kund:innen mit Zugang.</p>
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
              <ArrowRight aria-hidden="true" />
            </button>
          </form>

          <footer className={styles.cardFooter}>
            <span>Sicherer Zugang.</span>
            <div className={styles.footerLinks}>
              <a href="mailto:hallo@hasimuener.de">Hilfe</a>
              <span aria-hidden="true">·</span>
              <PrivacyDialog>
                <PrivacyContent modal />
              </PrivacyDialog>
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}
