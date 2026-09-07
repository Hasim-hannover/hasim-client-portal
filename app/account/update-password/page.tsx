import { updatePassword } from "./actions";

export default function UpdatePasswordPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="eyebrow">Hasim Client Portal</div>
        <h1>Neues Passwort</h1>
        <p className="lead login-lead">
          Vergib ein neues Passwort für deinen Zugang.
        </p>

        <form action={updatePassword} className="login-form">
          <label>
            Neues Passwort
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          <label>
            Passwort wiederholen
            <input
              type="password"
              name="passwordConfirm"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          {searchParams?.error ? (
            <p className="form-error" role="alert">{searchParams.error}</p>
          ) : null}

          <button type="submit">Passwort speichern</button>
        </form>
      </section>
    </main>
  );
}
