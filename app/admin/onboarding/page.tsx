import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";
import styles from "./onboarding.module.css";

export const dynamic = "force-dynamic";

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

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
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
            <h1 id="onboarding-title">Erst vorbereiten.<span>Dann einladen.</span></h1>
            <p className={styles.lead}>Lege Kunde, Projekt und Startphase an. Optional kannst du direkt eine PDF-Unterlage hochladen und als Vorschau prüfen.</p>
            <ol className={styles.sequence}>
              <li><span>01</span><div><strong>Projektraum anlegen</strong>Kunde, Projekt und aktuelle Phase werden vorbereitet.</div></li>
              <li><span>02</span><div><strong>PDF hinterlegen</strong>Angebot, Auftrag oder Vertrag direkt mit Vorschau hinzufügen.</div></li>
              <li><span>03</span><div><strong>Einladung senden</strong>Die Einladung verschickst du anschließend aus der Kundenakte.</div></li>
            </ol>
          </section>

          <section className={styles.card} aria-labelledby="workspace-form-title">
            <div className={styles.cardHeader}>
              <span>WERK / ONBOARDING</span>
              <h2 id="workspace-form-title">Projektraum vorbereiten</h2>
              <p>Es wird noch keine Einladungs-E-Mail versendet.</p>
            </div>
            <OnboardingForm message={message} error={error} />
          </section>
        </div>
      </div>
    </main>
  );
}
