import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClientWorkspace } from "./actions";
import styles from "./onboarding.module.css";

export const dynamic = "force-dynamic";

const phases = [
  ["onboarding", "Onboarding"],
  ["content", "Inhalte & Material"],
  ["concept", "Konzept"],
  ["development", "Umsetzung"],
  ["review", "Prüfung & Freigabe"],
  ["launch", "Launch"],
] as const;

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string | string[]; error?: string | string[] }>;
}) {
  const query = await searchParams;
  const message = Array.isArray(query.message) ? query.message[0] : query.message;
  const error = Array.isArray(query.error) ? query.error[0] : query.error;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/portal");

  return (
    <main className={styles.shell} id="main-content">
      <div className={styles.frame}>
        <header className={styles.topbar}>
          <Link className={styles.brand} href="/admin">
            <strong>WERK</strong>
            <span>Administration</span>
          </Link>
          <Link className={styles.backLink} href="/admin/clients">Kundenakten</Link>
        </header>

        <div className={styles.introGrid}>
          <section className={styles.copy} aria-labelledby="onboarding-title">
            <p className={styles.eyebrow}>Neuer Projektraum</p>
            <h1 id="onboarding-title">
              Erst vorbereiten.
              <span>Dann einladen.</span>
            </h1>
            <p className={styles.lead}>
              Lege Kunde, Projekt und Startphase an. Danach öffnet sich die Kundenakte. Dort kannst du Dateien, Unterlagen, Aufgaben und Freigaben vorbereiten, bevor der Kunde seinen Zugang erhält.
            </p>

            <ol className={styles.sequence}>
              <li><span>01</span><div><strong>Projektraum anlegen</strong>Kunde, Projekt und aktuelle Phase werden vorbereitet.</div></li>
              <li><span>02</span><div><strong>Arbeitsraum bestücken</strong>Dateien, Vorschauen, Aufgaben und Freigaben können vorab hinterlegt werden.</div></li>
              <li><span>03</span><div><strong>Einladung senden</strong>Erst wenn alles bereit ist, verschickst du den persönlichen Zugang aus der Kundenakte.</div></li>
            </ol>
          </section>

          <section className={styles.card} aria-labelledby="workspace-form-title">
            <div className={styles.cardHeader}>
              <span>WERK / ONBOARDING</span>
              <h2 id="workspace-form-title">Projektraum vorbereiten</h2>
              <p>Es wird noch keine Einladungs-E-Mail versendet.</p>
            </div>

            {message ? <div className={styles.notice} role="status">{message}</div> : null}
            {error ? <div className={styles.error} role="alert">{error}</div> : null}

            <form action={createClientWorkspace} className={styles.form}>
              <div className={styles.group}>
                <div className={styles.field}>
                  <label htmlFor="workspace-name">Ansprechpartner</label>
                  <input id="workspace-name" name="fullName" required maxLength={160} autoComplete="name" placeholder="Max Mustermann" />
                </div>
                <div className={styles.field}>
                  <label htmlFor="workspace-company">Unternehmen <span className={styles.optional}>optional</span></label>
                  <input id="workspace-company" name="companyName" maxLength={160} autoComplete="organization" placeholder="Muster GmbH" />
                </div>
              </div>

              <div className={styles.field}>
                <label htmlFor="workspace-email">E-Mail</label>
                <input id="workspace-email" name="email" type="email" required autoComplete="email" placeholder="kunde@example.de" />
              </div>

              <div className={styles.field}>
                <label htmlFor="workspace-project">Projekt</label>
                <input id="workspace-project" name="projectName" required maxLength={160} placeholder="Website Relaunch 2026" />
              </div>

              <div className={styles.field}>
                <label htmlFor="workspace-phase">Startphase</label>
                <select id="workspace-phase" name="phase" defaultValue="onboarding" required>
                  {phases.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>

              <div className={styles.field}>
                <label htmlFor="workspace-phase-note">Aktueller Projektstand <span className={styles.optional}>optional</span></label>
                <textarea id="workspace-phase-note" name="phaseNote" rows={4} maxLength={1200} placeholder="Zum Beispiel: Konzept steht, als Nächstes wird die Startseite zur Prüfung vorbereitet." />
              </div>

              <div className={styles.submitRow}>
                <p>Nach dem Anlegen gelangst du direkt in die Kundenakte. Die Einladung verschickst du dort bewusst separat.</p>
                <button className={styles.submit} type="submit">Projektraum anlegen</button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
