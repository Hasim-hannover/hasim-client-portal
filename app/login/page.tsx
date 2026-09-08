import Link from "next/link";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[]; message?: string | string[] }>;
}) {
  const query = await searchParams;
  const error = Array.isArray(query.error) ? query.error[0] : query.error;
  const message = Array.isArray(query.message) ? query.message[0] : query.message;

  return (
    <main className="login-shell" id="main-content">
      <section className="login-card" aria-labelledby="login-title">
        <div className="eyebrow">Hasim Client Portal</div>
        <h1 id="login-title">Projektzugang</h1>
        <p className="lead login-lead">Melde dich an, um Projektstatus, benötigte Unterlagen, Dateien und Nachrichten sicher zu verwalten.</p>

        {message ? <div className="form-success" role="status">{message}</div> : null}

        <form action={login} className="login-form">
          <label htmlFor="login-email">E-Mail</label>
          <input id="login-email" type="email" name="email" autoComplete="email" inputMode="email" required />
          <label htmlFor="login-password">Passwort</label>
          <input id="login-password" type="password" name="password" autoComplete="current-password" required />

          <div className="password-help-row"><Link href="/forgot-password">Passwort vergessen?</Link></div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button type="submit">Anmelden</button>
        </form>

        <p className="login-support">Probleme mit deinem Zugang? <a href="mailto:hallo@hasimuener.de">hallo@hasimuener.de</a></p>
        <p className="login-support">Für die Anmeldung werden nur technisch notwendige Sitzungs- und Sicherheitsdaten verwendet. <Link href="/datenschutz">Datenschutzhinweise</Link></p>
      </section>
    </main>
  );
}
