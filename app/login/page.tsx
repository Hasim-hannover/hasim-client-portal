import Link from "next/link";
import { login } from "./actions";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { error?: string; message?: string };
}) {
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="eyebrow">Hasim Client Portal</div>
        <h1>Projektzugang</h1>
        <p className="lead login-lead">
          Melde dich an, um Dateien und Projektmaterial sicher auszutauschen.
        </p>

        {searchParams?.message ? (
          <div className="form-success" role="status">{searchParams.message}</div>
        ) : null}

        <form action={login} className="login-form">
          <label>
            E-Mail
            <input type="email" name="email" autoComplete="email" required />
          </label>
          <label>
            Passwort
            <input type="password" name="password" autoComplete="current-password" required />
          </label>

          <div className="password-help-row">
            <Link href="/forgot-password">Passwort vergessen?</Link>
          </div>

          {searchParams?.error ? (
            <p className="form-error" role="alert">{searchParams.error}</p>
          ) : null}

          <button type="submit">Anmelden</button>
        </form>
      </section>
    </main>
  );
}
