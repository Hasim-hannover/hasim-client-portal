import { CheckCircle2, Mail, ShieldCheck, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { sendBrevoTestEmail } from "./actions";

function StatusRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <div className={`system-status-row ${ok ? "is-ok" : "is-error"}`}>
      <Icon size={18} aria-hidden="true" />
      <div><strong>{label}</strong><span>{detail}</span></div>
    </div>
  );
}

export async function SystemStatus() {
  const supabase = await createClient();
  const brevoConfigured = Boolean(process.env.BREVO_API_KEY && process.env.BREVO_FROM_EMAIL && process.env.NOTIFICATION_EMAIL);
  const adminConfigured = Boolean(process.env.SUPABASE_SECRET_KEY);

  const { data: deliveries } = await supabase
    .from("notification_deliveries")
    .select("ok, provider_status, recipient_email, error, created_at, kind")
    .order("created_at", { ascending: false })
    .limit(5);

  const latest = deliveries?.[0] ?? null;

  return (
    <section className="admin-panel system-panel" id="system" aria-labelledby="system-title">
      <div className="section-heading">
        <div><div className="eyebrow">Systemstatus</div><h2 id="system-title">Portal-Bereitschaft</h2></div>
        <ShieldCheck size={20} aria-hidden="true" />
      </div>

      <div className="system-status-list">
        <StatusRow ok={brevoConfigured} label="Brevo Transaktionsmails" detail={brevoConfigured ? "API-Konfiguration ist im produktiven Runtime-Umfeld vorhanden." : "BREVO_API_KEY, BREVO_FROM_EMAIL oder NOTIFICATION_EMAIL fehlt."} />
        <StatusRow ok={adminConfigured} label="Kundeneinladungen" detail={adminConfigured ? "Supabase Admin-Zugang ist konfiguriert." : "SUPABASE_SECRET_KEY fehlt noch in Vercel."} />
        <StatusRow ok={!latest || latest.ok} label="Letzter Mailversuch" detail={latest ? latest.ok ? `Erfolgreich an ${latest.recipient_email} · HTTP ${latest.provider_status}` : `Fehler ${latest.provider_status || "Netzwerk"}: ${latest.error || "unbekannt"}` : "Noch kein protokollierter Versandtest vorhanden."} />
      </div>

      <form action={sendBrevoTestEmail} className="system-test-form">
        <button className="secondary-button" type="submit" disabled={!brevoConfigured}><Mail size={16} aria-hidden="true" />Brevo-Testmail senden</button>
      </form>
    </section>
  );
}
