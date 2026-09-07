import Link from "next/link";
import { requestPasswordReset } from "./actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[]; sent?: string | string[] }>;
}) {
  const query = await searchParams;
  const error = Array.isArray(query.error) ? query.error[0] : query.error;
  const sentValue = Array.isArray(query.sent) ? query.sent[0] : query.sent;
  const sent = sentValue === "1";

  return (
    <main className="login-shell" id="main-content">
      <section className="login-card" aria-labelledby="forgot-title">
        <div className="eyebrow">Hasim Client Portal</div>
        <h1 id="forgot-title">Passwort vergessen</h1>
        <p className="lead login-lead">Gib deine E-Mail-Adresse ein. Du erhältst einen zeitlich begrenzten Link, mit dem du ein neues Passwort setzen kannst.</p>

        {sent ? (
          <div className="form-success" role="status">Wenn die E-Mail-Adresse zu einem Konto gehört, wurde eine Nachricht versendet. Bitte prüfe auch den Spam-Ordner.</div>
        ) : (
          <form action={requestPasswordReset} className="login-form">
            <label htmlFor="recovery-email">E-Mail</label>
            <input id="recovery-email" type="email" name="email" autoComplete="email" inputMode="email" required />
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            <button type="submit">Reset-Link senden</button>
          </form>
        )}

        <p className="login-link-row"><Link href="/login">Zurück zur Anmeldung</Link></p>
      </section>
    </main>
  );
}
