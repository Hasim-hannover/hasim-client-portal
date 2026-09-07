import Link from "next/link";
import { requestPasswordReset } from "./actions";

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams?: { error?: string; sent?: string };
}) {
  const sent = searchParams?.sent === "1";

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="eyebrow">Hasim Client Portal</div>
        <h1>Passwort vergessen</h1>
        <p className="lead login-lead">
          Gib deine E-Mail-Adresse ein. Du erhältst anschließend einen Link, mit dem du ein neues Passwort setzen kannst.
        </p>

        {sent ? (
          <div className="form-success" role="status">
            Wenn die E-Mail-Adresse zu einem Konto gehört, wurde eine Nachricht zum Zurücksetzen des Passworts versendet. Bitte prüfe auch den Spam-Ordner.
          </div>
        ) : (
          <form action={requestPasswordReset} className="login-form">
            <label>
              E-Mail
              <input type="email" name="email" autoComplete="email" required />
            </label>

            {searchParams?.error ? (
              <p className="form-error" role="alert">{searchParams.error}</p>
            ) : null}

            <button type="submit">Reset-Link senden</button>
          </form>
        )}

        <p className="login-link-row">
          <Link href="/login">Zurück zur Anmeldung</Link>
        </p>
      </section>
    </main>
  );
}
