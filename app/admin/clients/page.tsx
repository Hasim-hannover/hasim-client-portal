import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: ownProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (ownProfile?.role !== "admin") redirect("/portal");

  const [{ data: clients }, { data: projects }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, client_number, full_name, company_name, email, phone, created_at")
      .eq("role", "client")
      .order("created_at", { ascending: false }),
    supabase.from("projects").select("id, client_id, status, phase"),
  ]);

  const clientRows = clients ?? [];
  const projectRows = projects ?? [];

  return (
    <main className="main admin-main" id="main-content">
      <div className="eyebrow">Kundenakten</div>
      <h1>Kunden eindeutig erkennen und verwalten.</h1>
      <p className="lead">Jeder Kunde hat eine feste Kundennummer. In der Kundenakte siehst du alle Projekte, Uploads, Nachrichten und offenen Material-Anforderungen dieses Kunden.</p>

      <div className="section-heading" style={{ marginTop: 28 }}>
        <Link className="secondary-button button-link" href="/admin">← Zur Admin-Übersicht</Link>
        <span className="badge">{clientRows.length} Kunden</span>
      </div>

      {clientRows.length === 0 ? (
        <div className="empty-state">Noch keine Kundenkonten vorhanden.</div>
      ) : (
        <section className="admin-list" aria-label="Kundenakten">
          {clientRows.map((client) => {
            const clientProjects = projectRows.filter((project) => project.client_id === client.id);
            return (
              <article className="admin-list-row" key={client.id}>
                <div>
                  <strong>{client.company_name || client.full_name || "Ohne Namen"}</strong>
                  <span>{client.client_number || "Keine Kundennummer"} · {client.full_name || "Kein Ansprechpartner"} · {client.email || "Keine E-Mail"}</span>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span className="badge">{clientProjects.length} Projekte</span>
                  <Link className="secondary-button button-link" href={`/admin/clients/${client.id}`}>Kundenakte öffnen</Link>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
