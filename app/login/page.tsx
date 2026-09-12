import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  LockKeyhole,
  Mail,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { login } from "./actions";
import styles from "./login.module.css";

const benefits = [
  {
    title: "Kommunikation",
    text: "Direkt im Projekt",
    Icon: MessageSquare,
  },
  {
    title: "Unterlagen",
    text: "Zentral verfügbar",
    Icon: FileText,
  },
  {
    title: "Fortschritt",
    text: "Jederzeit im Blick",
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
      <div className={styles.editorialRail} aria-hidden="true">
        <span>Ideen · Struktur · Fortschritt</span>
      </div>

      <div className={styles.layout}>
        <section className={styles.brandPanel} aria-labelledby="werk-intro-title">
          <div className={styles.wordmark} aria-label="WERK Klientenportal">
            <span className={styles.wordmarkMain}>WERK</span>
            <span className={styles.wordmarkSub}>Klientenportal</span>
          </div>

          <div className={styles.brandCopy}>
            <p className={styles.eyebrow}>Effizient. Transparent. Gemeinsam.</p>
            <h1 id="werk-intro-title">
              Projekte.
              <span>Klar organisiert.</span>
            </h1>
            <p className={styles.intro}>
              Alle Projektdaten, Abstimmungen und Freigaben an einem zentralen Ort.
            </p>
          </div>

          <div className={styles.features} aria-label="Funktionen des WERK Klientenportals">
            {benefits.map(({ title, text, Icon }) => (
              <article className={styles.feature} key={title}>
                <div className={styles.featureIcon} aria-hidden="true">
                  <Icon />
                </div>
                <h2>{title}</h2>
                <p>{text}</p>
              </article>
            ))}
          </div>

          <div className={styles.signature}>
            <span aria-hidden="true" />
            <p>
              <strong>Entwickelt von Hasim Üner</strong>
              <small>Für eine strukturierte Zusammenarbeit.</small>
            </p>
          </div>
        </section>

        <section className={styles.loginCard} aria-labelledby="login-title">
          <div className={styles.cardMeta}>WERK / LOGIN</div>

          <div className={styles.cardHeading}>
            <h2 id="login-title">Willkommen zurück.</h2>
            <p>Melde dich an, um auf deine Projekte zuzugreifen.</p>
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
            <p className={styles.securityLine}>
              <ShieldCheck aria-hidden="true" />
              <span>Sicherer Zugang.</span>
            </p>
            <div className={styles.footerLinks}>
              <a href="mailto:hallo@hasimuener.de">Hilfe</a>
              <span aria-hidden="true">·</span>
              <Link href="/datenschutz">Datenschutz</Link>
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}
