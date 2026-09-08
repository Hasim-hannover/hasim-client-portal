import Link from "next/link";
import { Search } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function AdminSearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  const term = first(q).trim();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/portal");

  let clients: Array<{ id: string; client_number: string | null; full_name: string | null; company_name: string | null; email: string | null }> = [];
  let projects: Array<{ id: string; client_id: string; name: string; phase: string }> = [];
  let files: Array<{ id: string; project_id: string; file_name: string; created_at: string }> = [];

  if (term.length >= 2) {
    const safe = term.replaceAll("%", "\\%").replaceAll("_", "\\_");
    const [clientsResult, projectsResult, filesResult] = await Promise.all([
      supabase.from("profiles").select("id, client_number, full_name, company_name, email").eq("role", "client").or(`client_number.ilike.%${safe}%,full_name.ilike.%${safe}%,company_name.ilike.%${safe}%,email.ilike.%${safe}%`).limit(20),
      supabase.from("projects").select("id, client_id, name, phase").ilike("name", `%${safe}%`).limit(20),
      supabase.from("project_files").select("id, project_id, file_name, created_at").ilike("file_name", `%${safe}%`).limit(20),
    ]);
    clients = clientsResult.data ?? [];
    projects = projectsResult.data ?? [];
    files = filesResult.data ?? [];
  }

  const projectIds = Array.from(new Set(files.map((file) => file.project_id)));
  const { data: fileProjects } = projectIds.length ? await supabase.from("projects").select("id, client_id, name").in("id", projectIds) : { data: [] };
  const projectById = new Map((fileProjects ?? []).map((project) => [project.id, project]));
  const clientIds = Array.from(new Set([...projects.map((project) => project.client_id), ...(fileProjects ?? []).map((project) => project.client_id)]));
  const { data: relatedClients } = clientIds.length ? await supabase.from("profiles").select("id, full_name, company_name, client_number").in("id", clientIds) : { data: [] };
  const clientById = new Map((relatedClients ?? []).map((client) => [client.id, client]));

  return (
    <main className="main admin-main search-workspace" id="main-content">
      <div className="section-heading">
        <div><div className="eyebrow">Globale Suche</div><h1>Kunden, Projekte und Dateien finden.</h1><p className="lead">Suche nach Kundennummer, Firma, Ansprechpartner, E-Mail, Projekt oder Dateiname.</p></div>
        <Link className="secondary-button button-link" href="/admin">← Admin</Link>
      </div>

      <form className="global-search-form" method="get">
        <Search size={20} aria-hidden="true" />
        <label className="sr-only" htmlFor="global-search">Suchen</label>
        <input id="global-search" name="q" defaultValue={term} placeholder="z. B. DCS, K-000014 oder logo.svg" autoFocus />
        <button className="primary-button" type="submit">Suchen</button>
      </form>

      {term.length < 2 ? <div className="empty-state">Mindestens zwei Zeichen eingeben.</div> : (
        <div className="search-results-grid">
          <section className="admin-panel">
            <div className="section-heading compact-heading"><div><div className="eyebrow">Kunden</div><h2>{clients.length} Treffer</h2></div></div>
            {clients.length === 0 ? <div className="empty-state compact-empty">Keine Kunden gefunden.</div> : <div className="admin-list">{clients.map((client) => <div className="admin-list-row" key={client.id}><div><strong>{client.company_name || client.full_name || "Kunde"}</strong><span>{client.client_number || "—"} · {client.email || "Keine E-Mail"}</span></div><Link className="secondary-button button-link" href={`/admin/clients/${client.id}`}>Öffnen</Link></div>)}</div>}
          </section>

          <section className="admin-panel">
            <div className="section-heading compact-heading"><div><div className="eyebrow">Projekte</div><h2>{projects.length} Treffer</h2></div></div>
            {projects.length === 0 ? <div className="empty-state compact-empty">Keine Projekte gefunden.</div> : <div className="admin-list">{projects.map((project) => { const client = clientById.get(project.client_id); return <div className="admin-list-row" key={project.id}><div><strong>{project.name}</strong><span>{client?.company_name || client?.full_name || "Kunde"} · {project.phase}</span></div>{client ? <Link className="secondary-button button-link" href={`/admin/clients/${client.id}`}>Kundenakte</Link> : null}</div>; })}</div>}
          </section>

          <section className="admin-panel search-files-panel">
            <div className="section-heading compact-heading"><div><div className="eyebrow">Dateien</div><h2>{files.length} Treffer</h2></div></div>
            {files.length === 0 ? <div className="empty-state compact-empty">Keine Dateien gefunden.</div> : <div className="admin-list">{files.map((file) => { const project = projectById.get(file.project_id); const client = project ? clientById.get(project.client_id) : null; return <div className="admin-list-row" key={file.id}><div><strong>{file.file_name}</strong><span>{project?.name || "Projekt"} · {client?.company_name || client?.full_name || "Kunde"}</span></div>{client ? <Link className="secondary-button button-link" href={`/admin/clients/${client.id}#dateien`}>Kundenakte</Link> : null}</div>; })}</div>}
          </section>
        </div>
      )}
    </main>
  );
}
