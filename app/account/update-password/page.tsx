import { updatePassword } from "./actions";

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const query = await searchParams;
  const error = Array.isArray(query.error) ? query.error[0] : query.error;

  return (
    <main className="login-shell" id="main-content">
      <section className="login-card" aria-labelledby="new-password-title">
        <div className="eyebrow">Hasim Client Portal</div>
        <h1 id="new-password-title">Neues Passwort</h1>
        <p className="lead login-lead" id="password-rules">Vergib ein neues Passwort mit mindestens 8 Zeichen.</p>

        <form action={updatePassword} className="login-form">
          <label htmlFor="new-password">Neues Passwort</label>
          <input id="new-password" type="password" name="password" autoComplete="new-password" minLength={8} aria-describedby="password-rules" required />
          <label htmlFor="new-password-confirm">Passwort wiederholen</label>
          <input id="new-password-confirm" type="password" name="passwordConfirm" autoComplete="new-password" minLength={8} required />
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button type="submit">Passwort speichern</button>
        </form>
      </section>
    </main>
  );
}
