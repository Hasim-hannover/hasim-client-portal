import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, ChevronRight, FolderKanban, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(value));
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const phaseLabels: Record<string, string> = {
  onboarding: "Onboarding",
  content: "Inhalte & Material",
  concept: "Konzept",
  development: "Umsetzung",
  review: "Prüfung & Freigabe",
  launch: "Launch",
  completed: "Abgeschlossen",
};

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string | string[]; error?: string | string[] }>;
}) {
  const query = await searchParams;
  const message = first(query.message);
  const errorMessage = first(query.error);
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
    supabase.from("projects").select("id, client_id, name, status, phase, updated_at").order("updated_at", { ascending: false }),
  ]);

  const clientRows = clients ?? [];
  const projectRows = projects ?? [];
  const activeProjects = projectRows.filter((project) => project.status === "active").length;

  return (
    <main className="main admin-main client-index" id="main-content">
      <div className="client-page-header">
        <div>
          <div className="eyebrow">Kundenakten</div>
          <h1>Kunden eindeutig erkennen und verwalten.</h1>
          <p className="lead">Öffne einen Kunden und du siehst sofort Stammdaten, Projekte, Uploads, Nachrichten und offene Anforderungen.</p>
        </div>
        <Link className="secondary-button button-link" href="/admin">← Admin-Übersicht</Link>
      </div>

      {message ? <div className="form-success" role="status">{message}</div> : null}
      {errorMessage ? <div className="portal-warning" role="alert">{errorMessage}</div> : null}

      <section className="client-overview-grid" aria-label="Kundenübersicht">
        <article className="client-overview-card">
          <Users size={19} aria-hidden="true" />
          <div><strong>{clientRows.length}</strong><span>Kunden insgesamt</span></div>
        </article>
        <article className="client-overview-card">
          <FolderKanban size={19} aria-hidden="true" />
          <div><strong>{projectRows.length}</strong><span>Projekte insgesamt</span></div>
        </article>
        <article className="client-overview-card">
          <Building2 size={19} aria-hidden="true" />
          <div><strong>{activeProjects}</strong><span>aktive Projekte</span></div>
        </article>
      </section>

      <div className="client-list-heading">
        <div>
          <div className="eyebrow">Bestand</div>
          <h2>Alle Kunden</h2>
        </div>
        <span className="badge">{clientRows.length}</span>
      </div>

      {clientRows.length === 0 ? (
        <div className="empty-state">Noch keine Kundenkonten vorhanden.</div>
      ) : (
        <section className="client-card-grid" aria-label="Kundenakten">
          {clientRows.map((client) => {
            const clientProjects = projectRows.filter((project) => project.client_id === client.id);
            const latestProject = clientProjects[0];
            const displayName = client.company_name || client.full_name || "Ohne Namen";

            return (
              <article className="client-card" key={client.id}>
                <div className="client-card-topline">
                  <span className="client-number">{client.client_number || "Ohne Kundennummer"}</span>
                  <span className="badge">{clientProjects.length} {clientProjects.length === 1 ? "Projekt" : "Projekte"}</span>
                </div>

                <div className="client-card-copy">
                  <h3>{displayName}</h3>
                  {client.company_name && client.full_name ? <p>{client.full_name}</p> : null}
                  <span>{client.email || "Keine E-Mail hinterlegt"}</span>
                  {client.phone ? <span>{client.phone}</span> : null}
                </div>

                <div className="client-card-project-state">
                  {latestProject ? (
                    <>
                      <span>Letzter Projektstand</span>
                      <strong>{latestProject.name}</strong>
                      <small>{phaseLabels[latestProject.phase] ?? latestProject.phase} · aktualisiert {formatDate(latestProject.updated_at)}</small>
                    </>
                  ) : (
                    <span>Noch kein Projekt angelegt.</span>
                  )}
                </div>

                <Link className="client-card-link" href={`/admin/clients/${client.id}`} aria-label={`Kundenakte von ${displayName} öffnen`}>
                  Kundenakte öffnen <ChevronRight size={17} aria-hidden="true" />
                </Link>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
