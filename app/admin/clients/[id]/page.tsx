import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateClientProfile } from "../actions";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatBytes(value: number | null) {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export default async function ClientDossierPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string | string[]; error?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const message = Array.isArray(query.message) ? query.message[0] : query.message;
  const errorMessage = Array.isArray(query.error) ? query.error[0] : query.error;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: ownProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (ownProfile?.role !== "admin") redirect("/portal");

  const { data: client } = await supabase
    .from("profiles")
    .select("id, client_number, full_name, company_name, email, phone, created_at, role")
    .eq("id", id)
    .single();

  if (!client || client.role !== "client") notFound();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status, phase, phase_note, created_at, updated_at")
    .eq("client_id", id)
    .order("created_at", { ascending: false });

  const projectRows = projects ?? [];
  const projectIds = projectRows.map((project) => project.id);

  let files: Array<{ id: string; project_id: string; file_name: string; storage_path: string; size_bytes: number | null; note: string | null; created_at: string }> = [];
  let messages: Array<{ id: string; project_id: string; sender_id: string; body: string; created_at: string }> = [];
  let requests: Array<{ id: string; project_id: string; title: string; description: string | null; status: string; created_at: string }> = [];

  if (projectIds.length) {
    const [filesResult, messagesResult, requestsResult] = await Promise.all([
      supabase.from("project_files").select("id, project_id, file_name, storage_path, size_bytes, note, created_at").in("project_id", projectIds).order("created_at", { ascending: false }),
      supabase.from("project_messages").select("id, project_id, sender_id, body, created_at").in("project_id", projectIds).order("created_at", { ascending: false }),
      supabase.from("project_requests").select("id, project_id, title, description, status, created_at").in("project_id", projectIds).order("created_at", { ascending: false }),
    ]);
    files = filesResult.data ?? [];
    messages = messagesResult.data ?? [];
    requests = requestsResult.data ?? [];
  }

  const projectById = new Map(projectRows.map((project) => [project.id, project]));
  const signedByPath = new Map<string, string>();
  if (files.length) {
    const { data } = await supabase.storage.from("project-files").createSignedUrls(files.map((file) => file.storage_path), 60 * 10, { download: true });
    data?.forEach((item) => {
      if (item.path && item.signedUrl) signedByPath.set(item.path, item.signedUrl);
    });
  }

  const openRequests = requests.filter((request) => request.status !== "done");

  return (
    <main className="main admin-main" id="main-content">
      <div className="section-heading">
        <div>
          <div className="eyebrow">Kundenakte · {client.client_number || "ohne Nummer"}</div>
          <h1>{client.company_name || client.full_name || "Kunde"}</h1>
          <p className="lead">Alle Daten dieses Kunden an einer Stelle: Stammdaten, Projekte, Dateien, Nachrichten und Material-Anforderungen.</p>
        </div>
        <Link className="secondary-button button-link" href="/admin/clients">← Alle Kunden</Link>
      </div>

      {message ? <div className="form-success" role="status">{message}</div> : null}
      {errorMessage ? <div className="portal-warning" role="alert">{errorMessage}</div> : null}

      <section className="admin-stat-grid" aria-label="Kundenkennzahlen">
        <article className="admin-stat-card"><strong>{projectRows.length}</strong><span>Projekte</span></article>
        <article className="admin-stat-card"><strong>{files.length}</strong><span>Dateien</span></article>
        <article className="admin-stat-card"><strong>{messages.length}</strong><span>Nachrichten</span></article>
        <article className="admin-stat-card"><strong>{openRequests.length}</strong><span>offene Anforderungen</span></article>
      </section>

      <section className="admin-grid">
        <article className="admin-panel">
          <div className="eyebrow">Stammdaten</div>
          <h2>Kunde identifizieren</h2>
          <form action={updateClientProfile} className="admin-form">
            <input type="hidden" name="clientId" value={client.id} />
            <label htmlFor="client-number">Kundennummer</label>
            <input id="client-number" value={client.client_number || ""} readOnly aria-readonly="true" />
            <label htmlFor="company-name">Unternehmen</label>
            <input id="company-name" name="companyName" defaultValue={client.company_name || ""} maxLength={160} />
            <label htmlFor="full-name">Ansprechpartner</label>
            <input id="full-name" name="fullName" defaultValue={client.full_name || ""} required maxLength={160} />
            <label htmlFor="client-email">E-Mail</label>
            <input id="client-email" value={client.email || ""} readOnly aria-readonly="true" />
            <label htmlFor="phone">Telefon</label>
            <input id="phone" name="phone" defaultValue={client.phone || ""} maxLength={80} />
            <button className="primary-button" type="submit">Kundendaten speichern</button>
          </form>
        </article>

        <article className="admin-panel">
          <div className="eyebrow">Zugriff</div>
          <h2>Was du sehen kannst</h2>
          <p className="admin-hint">Du greifst nicht auf das Login des Kunden zu. Als Admin siehst du über deine eigenen Berechtigungen alle Projekte und die dazugehörigen Kundendaten. Das ist die richtige Trennung.</p>
          <div className="system-status-list">
            <div className="system-status-row"><div><strong>Dateien</strong><span>Alle Uploads aus allen Projekten dieses Kunden, inklusive Download.</span></div></div>
            <div className="system-status-row"><div><strong>Nachrichten</strong><span>Komplette projektbezogene Kommunikation.</span></div></div>
            <div className="system-status-row"><div><strong>Projektstatus</strong><span>Phase, Hinweise und offene Material-Anforderungen.</span></div></div>
          </div>
        </article>
      </section>

      <section className="admin-panel">
        <div className="section-heading"><div><div className="eyebrow">Projekte</div><h2>Projekte dieses Kunden</h2></div><span className="badge">{projectRows.length}</span></div>
        {projectRows.length === 0 ? <div className="empty-state">Noch keine Projekte.</div> : (
          <div className="admin-project-list">
            {projectRows.map((project) => (
              <article className="admin-project-card" key={project.id}>
                <div className="admin-project-head"><div><strong>{project.name}</strong><span>angelegt {formatDate(project.created_at)} · aktualisiert {formatDate(project.updated_at)}</span></div><span className="phase-pill">{project.phase}</span></div>
                {project.phase_note ? <p className="phase-note">{project.phase_note}</p> : null}
                <div className="admin-request-list">
                  {requests.filter((request) => request.project_id === project.id).map((request) => (
                    <div className="admin-request-row" key={request.id}><div><strong>{request.title}</strong><span>{request.status}</span>{request.description ? <p>{request.description}</p> : null}</div></div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="admin-grid">
        <article className="admin-panel">
          <div className="section-heading"><div><div className="eyebrow">Dateien</div><h2>Uploads des Kunden</h2></div><span className="badge">{files.length}</span></div>
          {files.length === 0 ? <div className="empty-state">Noch keine Dateien.</div> : (
            <div className="admin-list">
              {files.map((file) => {
                const signed = signedByPath.get(file.storage_path);
                return (
                  <div className="admin-list-row" key={file.id}>
                    <div><strong>{file.file_name}</strong><span>{projectById.get(file.project_id)?.name || "Projekt"} · {formatBytes(file.size_bytes)} · {formatDate(file.created_at)}</span>{file.note ? <p>{file.note}</p> : null}</div>
                    {signed ? <a className="secondary-button button-link" href={signed}>Download</a> : null}
                  </div>
                );
              })}
            </div>
          )}
        </article>

        <article className="admin-panel">
          <div className="section-heading"><div><div className="eyebrow">Kommunikation</div><h2>Nachrichten</h2></div><span className="badge">{messages.length}</span></div>
          {messages.length === 0 ? <div className="empty-state">Noch keine Nachrichten.</div> : (
            <div className="admin-list">
              {messages.map((entry) => (
                <div className="admin-list-row admin-message-row" key={entry.id}><div><strong>{entry.sender_id === client.id ? client.full_name || "Kunde" : "Hasim Üner"}</strong><span>{projectById.get(entry.project_id)?.name || "Projekt"} · {formatDate(entry.created_at)}</span><p>{entry.body}</p></div></div>
              ))}
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
