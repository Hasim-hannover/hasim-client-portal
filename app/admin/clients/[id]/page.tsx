import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Download, FolderKanban, Mail, MessageSquare, Phone, UploadCloud } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { updateClientProfile } from "../actions";

export const dynamic = "force-dynamic";

const phaseLabels: Record<string, string> = {
  onboarding: "Onboarding",
  content: "Inhalte & Material",
  concept: "Konzept",
  development: "Umsetzung",
  review: "Prüfung & Freigabe",
  launch: "Launch",
  completed: "Abgeschlossen",
};

const requestStatusLabels: Record<string, string> = {
  open: "Offen",
  submitted: "Eingereicht",
  done: "Erledigt",
};

type ProjectRow = {
  id: string;
  name: string;
  status: string;
  phase: string;
  phase_note: string | null;
  created_at: string;
  updated_at: string;
};

type ProjectFileRow = {
  id: string;
  project_id: string;
  uploader_id: string;
  file_name: string;
  storage_path: string;
  size_bytes: number | null;
  note: string | null;
  created_at: string;
};

type MessageRow = {
  id: string;
  project_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

type RequestRow = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
};

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

function renderFileList(
  entries: ProjectFileRow[],
  projectById: Map<string, ProjectRow>,
  signedByPath: Map<string, string>,
  emptyText: string,
) {
  if (entries.length === 0) return <div className="empty-state compact-empty">{emptyText}</div>;

  return (
    <div className="admin-list">
      {entries.map((file) => {
        const signed = signedByPath.get(file.storage_path);
        return (
          <div className="admin-list-row dossier-file-row" key={file.id}>
            <div>
              <strong>{file.file_name}</strong>
              <span>{projectById.get(file.project_id)?.name || "Projekt"} · {formatBytes(file.size_bytes)} · {formatDate(file.created_at)}</span>
              {file.note ? <p>{file.note}</p> : null}
            </div>
            {signed ? (
              <a className="secondary-button button-link" href={signed}>
                <Download size={16} aria-hidden="true" /> Download
              </a>
            ) : null}
          </div>
        );
      })}
    </div>
  );
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
    .order("updated_at", { ascending: false });

  const projectRows = (projects ?? []) as ProjectRow[];
  const projectIds = projectRows.map((project) => project.id);

  let files: ProjectFileRow[] = [];
  let messages: MessageRow[] = [];
  let requests: RequestRow[] = [];

  if (projectIds.length) {
    const [filesResult, messagesResult, requestsResult] = await Promise.all([
      supabase.from("project_files").select("id, project_id, uploader_id, file_name, storage_path, size_bytes, note, created_at").in("project_id", projectIds).order("created_at", { ascending: false }),
      supabase.from("project_messages").select("id, project_id, sender_id, body, created_at").in("project_id", projectIds).order("created_at", { ascending: false }),
      supabase.from("project_requests").select("id, project_id, title, description, status, created_at").in("project_id", projectIds).order("created_at", { ascending: false }),
    ]);
    files = (filesResult.data ?? []) as ProjectFileRow[];
    messages = (messagesResult.data ?? []) as MessageRow[];
    requests = (requestsResult.data ?? []) as RequestRow[];
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
  const customerUploads = files.filter((file) => file.uploader_id === client.id);
  const adminFiles = files.filter((file) => file.uploader_id !== client.id);
  const latestProject = projectRows[0];
  const displayName = client.company_name || client.full_name || "Kunde";

  return (
    <main className="main admin-main client-dossier" id="main-content">
      <div className="dossier-hero">
        <div>
          <div className="eyebrow">Kundenakte · {client.client_number || "ohne Nummer"}</div>
          <h1>{displayName}</h1>
          <div className="dossier-contact-line" aria-label="Kontaktdaten">
            {client.full_name && client.company_name ? <span>{client.full_name}</span> : null}
            {client.email ? <a href={`mailto:${client.email}`}><Mail size={15} aria-hidden="true" />{client.email}</a> : null}
            {client.phone ? <a href={`tel:${client.phone}`}><Phone size={15} aria-hidden="true" />{client.phone}</a> : null}
          </div>
          <p className="lead">Dein Arbeitsbereich für diesen Kunden: Projekte steuern, Kundenuploads prüfen und Kommunikation nachvollziehen.</p>
        </div>
        <div className="dossier-header-actions">
          <Link className="secondary-button button-link" href="/admin/clients">← Alle Kunden</Link>
          <Link className="primary-button button-link" href="/admin#communication">Nachricht / Datei senden</Link>
        </div>
      </div>

      <nav className="dossier-subnav" aria-label="Bereiche der Kundenakte">
        <a href="#overview">Übersicht</a>
        <a href="#projects">Projekte</a>
        <a href="#customer-files">Kundenuploads</a>
        <a href="#messages">Nachrichten</a>
      </nav>

      {message ? <div className="form-success" role="status">{message}</div> : null}
      {errorMessage ? <div className="portal-warning" role="alert">{errorMessage}</div> : null}

      <section className="admin-stat-grid dossier-stats" id="overview" aria-label="Kundenkennzahlen">
        <article className="admin-stat-card"><FolderKanban size={19} aria-hidden="true" /><strong>{projectRows.length}</strong><span>Projekte</span></article>
        <article className="admin-stat-card"><UploadCloud size={19} aria-hidden="true" /><strong>{customerUploads.length}</strong><span>Uploads vom Kunden</span></article>
        <article className="admin-stat-card"><MessageSquare size={19} aria-hidden="true" /><strong>{messages.length}</strong><span>Nachrichten</span></article>
        <article className="admin-stat-card"><strong>{openRequests.length}</strong><span>offene Anforderungen</span></article>
      </section>

      {latestProject ? (
        <section className="dossier-current-state" aria-label="Aktueller Projektstand">
          <div>
            <span>Aktueller Projektstand</span>
            <strong>{latestProject.name}</strong>
            <small>zuletzt aktualisiert {formatDate(latestProject.updated_at)}</small>
          </div>
          <span className="phase-pill">{phaseLabels[latestProject.phase] ?? latestProject.phase}</span>
        </section>
      ) : null}

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

        <article className="admin-panel dossier-access-panel">
          <div className="eyebrow">Admin-Zugriff</div>
          <h2>Alles zum Kunden, ohne Kunden-Login</h2>
          <p className="admin-hint">Du arbeitest mit deinem eigenen Admin-Zugang. Die Kundendaten bleiben sauber getrennt, sind für dich aber vollständig projektbezogen sichtbar.</p>
          <div className="dossier-access-list">
            <div><UploadCloud size={18} aria-hidden="true" /><span><strong>{customerUploads.length} Kundenuploads</strong><small>Alle vom Kunden hochgeladenen Dateien.</small></span></div>
            <div><Download size={18} aria-hidden="true" /><span><strong>{adminFiles.length} bereitgestellte Dateien</strong><small>Dateien, die du für den Kunden hochgeladen hast.</small></span></div>
            <div><MessageSquare size={18} aria-hidden="true" /><span><strong>{messages.length} Nachrichten</strong><small>Projektbezogene Kommunikation in einer Historie.</small></span></div>
          </div>
        </article>
      </section>

      <section className="admin-panel" id="projects">
        <div className="section-heading"><div><div className="eyebrow">Projekte</div><h2>Projekte dieses Kunden</h2></div><span className="badge">{projectRows.length}</span></div>
        {projectRows.length === 0 ? <div className="empty-state">Noch keine Projekte.</div> : (
          <div className="admin-project-list">
            {projectRows.map((project) => {
              const projectRequests = requests.filter((request) => request.project_id === project.id);
              return (
                <article className="admin-project-card" key={project.id}>
                  <div className="admin-project-head">
                    <div><strong>{project.name}</strong><span>angelegt {formatDate(project.created_at)} · aktualisiert {formatDate(project.updated_at)}</span></div>
                    <span className="phase-pill">{phaseLabels[project.phase] ?? project.phase}</span>
                  </div>
                  {project.phase_note ? <p className="phase-note">{project.phase_note}</p> : null}
                  {projectRequests.length ? (
                    <div className="admin-request-list">
                      {projectRequests.map((request) => (
                        <div className="admin-request-row" key={request.id}>
                          <div><strong>{request.title}</strong><span>{requestStatusLabels[request.status] ?? request.status}</span>{request.description ? <p>{request.description}</p> : null}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="admin-grid dossier-files-grid" id="customer-files">
        <article className="admin-panel">
          <div className="section-heading"><div><div className="eyebrow">Vom Kunden</div><h2>Kundenuploads</h2></div><span className="badge">{customerUploads.length}</span></div>
          <p className="admin-hint">Hier stehen ausschließlich Dateien, die dieser Kunde selbst hochgeladen hat.</p>
          {renderFileList(customerUploads, projectById, signedByPath, "Der Kunde hat noch keine Dateien hochgeladen.")}
        </article>

        <article className="admin-panel">
          <div className="section-heading"><div><div className="eyebrow">Von dir</div><h2>Bereitgestellte Dateien</h2></div><span className="badge">{adminFiles.length}</span></div>
          <p className="admin-hint">Dateien, die du dem Kunden über seine Projekte bereitgestellt hast.</p>
          {renderFileList(adminFiles, projectById, signedByPath, "Du hast diesem Kunden noch keine Dateien bereitgestellt.")}
        </article>
      </section>

      <section className="admin-panel" id="messages">
        <div className="section-heading"><div><div className="eyebrow">Kommunikation</div><h2>Nachrichtenverlauf</h2></div><span className="badge">{messages.length}</span></div>
        {messages.length === 0 ? <div className="empty-state">Noch keine Nachrichten.</div> : (
          <div className="dossier-message-list">
            {messages.map((entry) => {
              const fromCustomer = entry.sender_id === client.id;
              return (
                <article className={`dossier-message ${fromCustomer ? "from-customer" : "from-admin"}`} key={entry.id}>
                  <div className="dossier-message-meta">
                    <strong>{fromCustomer ? client.full_name || "Kunde" : "Hasim Üner"}</strong>
                    <span>{projectById.get(entry.project_id)?.name || "Projekt"} · {formatDate(entry.created_at)}</span>
                  </div>
                  <p>{entry.body}</p>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
