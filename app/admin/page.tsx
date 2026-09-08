import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderKanban, LogOut, MailPlus, MessageSquare, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/portal/actions";
import { MessagePanel } from "@/app/portal/message-panel";
import { UploadPanel } from "@/app/portal/upload-panel";
import {
  createProject,
  createProjectRequest,
  inviteClient,
  updateProjectPhase,
  updateProjectRequestStatus,
} from "./actions";
import { SystemStatus } from "./system-status";

export const dynamic = "force-dynamic";

const phases = [
  ["onboarding", "Onboarding"],
  ["content", "Inhalte & Material"],
  ["concept", "Konzept"],
  ["development", "Umsetzung"],
  ["review", "Prüfung & Freigabe"],
  ["launch", "Launch"],
  ["completed", "Abgeschlossen"],
] as const;
const phaseLabels = Object.fromEntries(phases);
const requestStatusLabels: Record<string, string> = {
  open: "Offen",
  submitted: "Eingereicht",
  done: "Erledigt",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string | string[]; error?: string | string[] }>;
}) {
  const query = await searchParams;
  const message = Array.isArray(query.message) ? query.message[0] : query.message;
  const errorMessage = Array.isArray(query.error) ? query.error[0] : query.error;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: ownProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (ownProfile?.role !== "admin") redirect("/portal");

  const [profilesResult, projectsResult, messagesResult, filesResult, requestsResult] = await Promise.all([
    supabase.from("profiles").select("id, client_number, full_name, company_name, email, role, created_at").order("created_at", { ascending: false }),
    supabase.from("projects").select("id, client_id, name, status, phase, phase_note, created_at, updated_at").order("created_at", { ascending: false }),
    supabase.from("project_messages").select("id, project_id, sender_id, body, created_at").order("created_at", { ascending: false }).limit(12),
    supabase.from("project_files").select("id, project_id, file_name, storage_path, size_bytes, created_at").order("created_at", { ascending: false }).limit(12),
    supabase.from("project_requests").select("id, project_id, title, description, status, created_at, updated_at").order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
  ]);

  const profiles = profilesResult.data ?? [];
  const clients = profiles.filter((profile) => profile.role === "client");
  const projects = projectsResult.data ?? [];
  const messages = messagesResult.data ?? [];
  const files = filesResult.data ?? [];
  const requests = requestsResult.data ?? [];
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const compactProjects = projects.map(({ id, name }) => ({ id, name }));
  const compactRequests = requests.map((request) => ({
    id: request.id,
    projectId: request.project_id,
    title: request.title,
    status: request.status as "open" | "submitted" | "done",
  }));

  const signedByPath = new Map<string, string>();
  if (files.length) {
    const { data } = await supabase.storage.from("project-files").createSignedUrls(files.map((file) => file.storage_path), 60 * 10);
    data?.forEach((item) => {
      if (item.path && item.signedUrl) signedByPath.set(item.path, item.signedUrl);
    });
  }

  return (
    <div className="portal-shell admin-shell">
      <a className="skip-link" href="#main-content">Zum Inhalt springen</a>
      <aside className="sidebar" aria-label="Admin-Navigation">
        <div className="brand">Hasim Client Portal</div>
        <nav className="nav" aria-label="Admin Navigation">
          <a className="nav-item active" href="#overview" aria-current="location">Übersicht</a>
          <Link className="nav-item" href="/admin/clients">Kundenakten</Link>
          <a className="nav-item" href="#projects">Projekte</a>
          <a className="nav-item" href="#communication">Kommunikation</a>
          <a className="nav-item" href="#system">System</a>
          <Link className="nav-item" href="/portal">Kundenansicht</Link>
        </nav>
        <form action={logout} className="logout-form">
          <button type="submit" className="logout-button"><LogOut size={16} aria-hidden="true" />Abmelden</button>
        </form>
      </aside>

      <main className="main admin-main" id="main-content">
        <div id="overview" className="anchor-target">
          <div className="eyebrow">Backend</div>
          <h1>Kunden und Projekte steuern.</h1>
          <p className="lead">Hier steuerst du den kompletten Kundenfluss: Zugang, Projektphase, benötigte Unterlagen, Dateien und Kommunikation.</p>
        </div>

        {message ? <div className="form-success" role="status">{message}</div> : null}
        {errorMessage ? <div className="portal-warning" role="alert">{errorMessage}</div> : null}

        <section className="admin-stat-grid" aria-label="Portal Kennzahlen">
          <article className="admin-stat-card"><Users size={19} aria-hidden="true" /><strong>{clients.length}</strong><span>Kunden</span></article>
          <article className="admin-stat-card"><FolderKanban size={19} aria-hidden="true" /><strong>{projects.length}</strong><span>Projekte</span></article>
          <article className="admin-stat-card"><MessageSquare size={19} aria-hidden="true" /><strong>{messages.length}</strong><span>letzte Nachrichten</span></article>
          <article className="admin-stat-card"><MailPlus size={19} aria-hidden="true" /><strong>{files.length}</strong><span>letzte Dateien</span></article>
        </section>

        <SystemStatus />

        <section className="admin-grid" id="clients" aria-label="Kundenverwaltung">
          <article className="admin-panel">
            <div className="section-heading compact-heading"><div><div className="eyebrow">Kundenverwaltung</div><h2>Neuen Kunden einladen</h2></div></div>
            <form action={inviteClient} className="admin-form">
              <label htmlFor="invite-name">Name</label><input id="invite-name" name="fullName" required autoComplete="name" placeholder="Max Mustermann" />
              <label htmlFor="invite-email">E-Mail</label><input id="invite-email" name="email" type="email" required autoComplete="email" placeholder="kunde@example.de" />
              <label htmlFor="invite-project">Erstes Projekt <span className="optional-label">optional</span></label><input id="invite-project" name="projectName" placeholder="Website Relaunch" />
              <button className="primary-button" type="submit">Einladung senden</button>
            </form>
          </article>

          <article className="admin-panel">
            <div className="section-heading compact-heading">
              <div><div className="eyebrow">Bestand</div><h2>Kunden</h2></div>
              <Link className="secondary-button button-link" href="/admin/clients">Alle Kundenakten</Link>
            </div>
            {clients.length === 0 ? <div className="empty-state">Noch keine echten Kundenkonten angelegt.</div> : (
              <div className="admin-list">
                {clients.slice(0, 6).map((client) => {
                  const displayName = client.company_name || client.full_name || "Ohne Namen";
                  const projectCount = projects.filter((project) => project.client_id === client.id).length;
                  return (
                    <div className="admin-list-row" key={client.id}>
                      <div>
                        <strong>{displayName}</strong>
                        <span>{client.client_number || "Ohne Kundennummer"} · {client.email || "Keine E-Mail"} · {projectCount} {projectCount === 1 ? "Projekt" : "Projekte"}</span>
                      </div>
                      <Link className="secondary-button button-link" href={`/admin/clients/${client.id}`}>Kundenakte öffnen</Link>
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        </section>

        <section className="admin-panel" id="projects" aria-labelledby="projects-title">
          <div className="section-heading"><div><div className="eyebrow">Projektsteuerung</div><h2 id="projects-title">Projekte, Phase & benötigte Inhalte</h2></div><span className="badge">{projects.length}</span></div>
          {clients.length ? (
            <form action={createProject} className="admin-create-project-form">
              <label htmlFor="project-client">Kunde</label><select id="project-client" name="clientId" required>{clients.map((client) => <option key={client.id} value={client.id}>{client.company_name || client.full_name || client.email}</option>)}</select>
              <label htmlFor="project-name">Projektname</label><input id="project-name" name="name" required maxLength={160} placeholder="Website Relaunch" />
              <button className="secondary-button" type="submit">Projekt anlegen</button>
            </form>
          ) : null}

          {projects.length === 0 ? <div className="empty-state">Noch keine Projekte vorhanden.</div> : (
            <div className="admin-project-list">{projects.map((project) => {
              const client = profileById.get(project.client_id);
              const projectRequests = requests.filter((request) => request.project_id === project.id);
              return (
                <article className="admin-project-card" key={project.id}>
                  <div className="admin-project-head"><div><strong>{project.name}</strong><span>{client?.company_name || client?.full_name || client?.email || "Test-/Adminprojekt"} · aktualisiert {formatDate(project.updated_at)}</span></div><span className="phase-pill">{phaseLabels[project.phase] ?? project.phase}</span></div>

                  <form action={updateProjectPhase} className="admin-phase-form">
                    <input type="hidden" name="projectId" value={project.id} />
                    <label htmlFor={`phase-${project.id}`}>Phase</label><select id={`phase-${project.id}`} name="phase" defaultValue={project.phase}>{phases.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                    <label className="admin-phase-note" htmlFor={`phase-note-${project.id}`}>Hinweis für den Kunden</label><textarea id={`phase-note-${project.id}`} className="admin-phase-note" name="phaseNote" rows={3} maxLength={1200} defaultValue={project.phase_note ?? ""} placeholder="Zum Beispiel: Inhalte sind vollständig, Umsetzung startet diese Woche." />
                    <button className="primary-button" type="submit">Phase speichern</button>
                  </form>

                  <div className="admin-request-block">
                    <div className="admin-request-heading"><div><div className="eyebrow">Materialfluss</div><h3>Was brauche ich noch vom Kunden?</h3></div><span className="badge">{projectRequests.filter((request) => request.status !== "done").length} offen</span></div>
                    <form action={createProjectRequest} className="admin-request-form">
                      <input type="hidden" name="projectId" value={project.id} />
                      <label htmlFor={`request-title-${project.id}`}>Benötigtes Material</label><input id={`request-title-${project.id}`} name="title" required maxLength={160} placeholder="z. B. Firmenlogo als SVG oder PNG" />
                      <label htmlFor={`request-description-${project.id}`}>Beschreibung <span className="optional-label">optional</span></label><textarea id={`request-description-${project.id}`} name="description" rows={2} maxLength={1200} placeholder="Kurzer Hinweis, welche Datei oder Information benötigt wird." />
                      <button className="secondary-button" type="submit">Material anfordern</button>
                    </form>

                    {projectRequests.length ? <div className="admin-request-list">{projectRequests.map((request) => (
                      <div className="admin-request-row" key={request.id}>
                        <div><strong>{request.title}</strong><span>{requestStatusLabels[request.status] ?? request.status}</span>{request.description ? <p>{request.description}</p> : null}</div>
                        <form action={updateProjectRequestStatus} className="request-status-form">
                          <input type="hidden" name="requestId" value={request.id} />
                          <label className="sr-only" htmlFor={`request-status-${request.id}`}>Status für {request.title}</label>
                          <select id={`request-status-${request.id}`} name="status" defaultValue={request.status}>
                            <option value="open">Offen</option><option value="submitted">Eingereicht</option><option value="done">Erledigt</option>
                          </select>
                          <button className="secondary-button" type="submit">Aktualisieren</button>
                        </form>
                      </div>
                    ))}</div> : <div className="empty-state compact-empty">Noch keine Material-Anforderungen.</div>}
                  </div>
                </article>
              );
            })}</div>
          )}
        </section>

        <section className="admin-grid" id="communication">
          <UploadPanel projects={compactProjects} requests={compactRequests} />
          <MessagePanel projects={compactProjects} />
        </section>

        <section className="admin-grid" aria-label="Letzte Aktivität">
          <article className="admin-panel">
            <div className="section-heading compact-heading"><div><div className="eyebrow">Aktivität</div><h2>Letzte Nachrichten</h2></div></div>
            {messages.length === 0 ? <div className="empty-state">Keine Nachrichten.</div> : <div className="admin-list">{messages.map((entry) => { const project = projectById.get(entry.project_id); const sender = profileById.get(entry.sender_id); return <div className="admin-list-row admin-message-row" key={entry.id}><div><strong>{sender?.company_name || sender?.full_name || sender?.email || "Unbekannt"}</strong><span>{project?.name || "Projekt"} · {formatDate(entry.created_at)}</span><p>{entry.body}</p></div></div>; })}</div>}
          </article>
          <article className="admin-panel">
            <div className="section-heading compact-heading"><div><div className="eyebrow">Aktivität</div><h2>Letzte Dateien</h2></div></div>
            {files.length === 0 ? <div className="empty-state">Keine Dateien.</div> : <div className="admin-list">{files.map((file) => { const signed = signedByPath.get(file.storage_path); const href = signed ? `${signed}${signed.includes("?") ? "&" : "?"}download=${encodeURIComponent(file.file_name)}` : null; return <div className="admin-list-row" key={file.id}><div><strong>{file.file_name}</strong><span>{projectById.get(file.project_id)?.name || "Projekt"} · {formatDate(file.created_at)}</span></div>{href ? <a className="secondary-button button-link" href={href}>Download</a> : null}</div>; })}</div>}
          </article>
        </section>
      </main>
    </div>
  );
}
