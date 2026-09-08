import { createClient } from "@/lib/supabase/server";

const labels: Record<string, string> = {
  invite: "Einladung",
  recovery: "Zugangslink / Passwort",
  upload_owner: "Kundenupload → Admin",
  upload_customer: "Upload-Bestätigung",
  message_owner: "Kundennachricht → Admin",
  message_customer: "Nachricht an Kunde",
  request_customer: "Material-Anforderung",
  phase_customer: "Projektstatus",
  action_customer: "Kundenaufgabe",
  action_response_owner: "Kundenaktion → Admin",
  test: "Systemtest",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export async function CommunicationHealth({ email }: { email: string | null }) {
  if (!email) return null;
  const supabase = await createClient();
  const { data: deliveries } = await supabase
    .from("notification_deliveries")
    .select("id, kind, recipient_email, provider_status, ok, error, created_at")
    .eq("recipient_email", email)
    .order("created_at", { ascending: false })
    .limit(10);

  const rows = deliveries ?? [];
  const failed = rows.filter((row) => !row.ok).length;

  return (
    <section className="admin-panel communication-health" id="communication-health" aria-labelledby="communication-health-title">
      <div className="section-heading">
        <div><div className="eyebrow">Transaktionsmails</div><h2 id="communication-health-title">Kommunikationsstatus</h2></div>
        <span className={failed ? "delivery-summary has-errors" : "delivery-summary is-ok"}>
          <span className={`health-dot ${failed ? "is-error" : "is-ok"}`} aria-hidden="true" />
          {failed ? `${failed} auffällig` : "Versand stabil"}
        </span>
      </div>
      <p className="admin-hint">Die letzten automatischen E-Mails an diesen Kunden – Einladung, Zugangslinks, Nachrichten, Dateien, Aufgaben und Projektupdates.</p>
      {rows.length === 0 ? <div className="empty-state compact-empty">Noch keine Transaktionsmail für diesen Kunden protokolliert.</div> : (
        <div className="delivery-list">
          {rows.map((row) => (
            <div className={`delivery-row ${row.ok ? "is-ok" : "is-error"}`} key={row.id}>
              <span className={`health-dot ${row.ok ? "is-ok" : "is-error"}`} aria-hidden="true" />
              <div>
                <strong>{labels[row.kind] ?? row.kind}</strong>
                <span><span className="sr-only">{row.ok ? "Zustellung erfolgreich. " : "Zustellung fehlerhaft. "}</span>{formatDate(row.created_at)} · Brevo {row.provider_status || "—"}</span>
                {!row.ok && row.error ? <p>{row.error}</p> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
