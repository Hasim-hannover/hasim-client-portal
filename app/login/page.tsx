import { login } from "./actions";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="eyebrow">Hasim Client Portal</div>
        <h1>Projektzugang</h1>
        <p className="lead login-lead">
          Melde dich an, um Dateien und Projektmaterial sicher auszutauschen.
        </p>

        <form action={login} className="login-form">
          <label>
            E-Mail
            <input type="email" name="email" autoComplete="email" required />
          </label>
          <label>
            Passwort
            <input type="password" name="password" autoComplete="current-password" required />
          </label>

          {searchParams?.error ? (
            <p className="form-error" role="alert">{searchParams.error}</p>
          ) : null}

          <button type="submit">Anmelden</button>
        </form>
      </section>
    </main>
  );
}
