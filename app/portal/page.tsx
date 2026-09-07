import { redirect } from "next/navigation";
import {
  CheckCircle2,
  CircleDot,
  FileArchive,
  FileText,
  HelpCircle,
  Image,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  UploadCloud,
  Video,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./actions";
import { MessagePanel } from "./message-panel";
import { UploadPanel } from "./upload-panel";

export const dynamic = "force-dynamic";

const areas = [
  { key: "image", title: "Bilder & Grafiken", description: "Logos, Fotos, Screenshots und Produktbilder.", icon: Image },
  { key: "document", title: "Dokumente & PDF", description: "Briefings, Texte, PDFs, Word- und Office-Dateien.", icon: FileText },
  { key: "video", title: "Videos", description: "Rohmaterial, Aufnahmen und Referenzvideos.", icon: Video },
  { key: "other", title: "Sonstiges", description: "Weitere Dateien, die zu deinem Projekt gehören.", icon: FileArchive },
];

const categoryLabels: Record<string, string> = Object.fromEntries(areas.map((area) => [area.key, area.title]));
const phaseLabels: Record<string, string> = {
  onboarding: "Onboarding",
  content: "Inhalte & Material",
  concept: "Konzept",
  development: "Umsetzung",
  review: "Prüfung & Freigabe",
  launch: "Launch",
  completed: "Abgeschlossen",
};
const phaseOrder = ["onboarding", "content", "concept", "development", "review", "launch", "completed"];

const requestLabels: Record<string, string> = {
  open: "Noch benötigt",
  submitted: "Eingereicht – wird geprüft",
  done: "Erledigt",
};

function formatBytes(bytes: number | null) {
  if (!bytes) return "–";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function getSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ request?: string | string[] }>;
}) {
  const query = await searchParams;
  const requestedUploadId = getSearchValue(query.request);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [projectsResult, filesResult, messagesResult, requestsResult] = await Promise.all([
    supabase.from("projects").select("id, name, status, phase, phase_note, updated_at").order("created_at", { ascending: false }),
    supabase.from("project_files").select("id, project_id, request_id, upload_id, category, note, file_name, storage_path, mime_type, size_bytes, created_at").order("created_at", { ascending: false }).limit(60),
    supabase.from("project_messages").select("id, project_id, sender_id, body, created_at").order("created_at", { ascending: false }).limit(20),
    supabase.from("project_requests").select("id, project_id, title, description, status, created_at, updated_at").order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
  ]);

  const projectList = projectsResult.data ?? [];
  const projectNames = new Map(projectList.map((project) => [project.id, project.name]));
  const loadError = projectsResult.error ?? filesResult.error ?? messagesResult.error ?? requestsResult.error;
  const rawFiles = filesResult.data ?? [];

  const signedByPath = new Map<string, string>();
  if (rawFiles.length) {
    const { data: signedUrls } = await supabase.storage
      .from("project-files")
      .createSignedUrls(rawFiles.map((file) => file.storage_path), 60 * 10);

    signedUrls?.forEach((item) => {
      if (item.signedUrl && item.path) signedByPath.set(item.path, item.signedUrl);
    });
  }

  const fileList = rawFiles.map((file) => {
    const signedUrl = signedByPath.get(file.storage_path) ?? null;
    const downloadUrl = signedUrl
      ? `${signedUrl}${signedUrl.includes("?") ? "&" : "?"}download=${encodeURIComponent(file.file_name)}`
      : null;
    return { ...file, signedUrl: downloadUrl, projectName: projectNames.get(file.project_id) ?? "Projekt" };
  });

  const uploadGroups = Array.from(fileList.reduce((groups, file) => {
    const key = file.upload_id ?? file.id;
    const current = groups.get(key) ?? {
      id: key,
      projectName: file.projectName,
      category: file.category,
      note: file.note,
      createdAt: file.created_at,
      files: [] as typeof fileList,
    };
    current.files.push(file);
    groups.set(key, current);
    return groups;
  }, new Map<string, { id: string; projectName: string; category: string; note: string | null; createdAt: string; files: typeof fileList }>())).map(([, group]) => group);

  const messages = (messagesResult.data ?? []).map((message) => ({
    ...message,
    projectName: projectNames.get(message.project_id) ?? "Projekt",
    senderLabel: message.sender_id === user.id ? "Du" : "Hasim Üner",
  }));

  const projectRequests = (requestsResult.data ?? []).map((request) => ({
    ...request,
    projectName: projectNames.get(request.project_id) ?? "Projekt",
  }));
  const openRequests = projectRequests.filter((request) => request.status !== "done");
  const compactProjects = projectList.map(({ id, name }) => ({ id, name }));
  const compactRequests = projectRequests.map((request) => ({
    id: request.id,
    projectId: request.project_id,
    title: request.title,
    status: request.status as "open" | "submitted" | "done",
  }));

  return (
    <div className="portal-shell">
      <a className="skip-link" href="#main-content">Zum Inhalt springen</a>
      <aside className="sidebar" aria-label="Kundenportal Navigation">
        <div className="brand">Hasim Client Portal</div>
        <nav className="nav" aria-label="Portal Navigation">
          <a className="nav-item active" href="#dashboard" aria-current="location">Übersicht</a>
          <a className="nav-item" href="#anforderungen">Benötigte Inhalte</a>
          <a className="nav-item" href="#projektstatus">Projektstatus</a>
          <a className="nav-item" href="#upload">Upload</a>
          <a className="nav-item" href="#dateien">Dateien</a>
          <a className="nav-item" href="#nachrichten">Nachrichten</a>
        </nav>
        <form action={logout} className="logout-form">
          <button type="submit" className="logout-button"><LogOut size={16} aria-hidden="true" />Abmelden</button>
        </form>
      </aside>

      <main className="main" id="main-content">
        <section className="portal-hero-grid" id="dashboard">
          <div className="portal-hero-copy">
            <div className="eyebrow">Kundenportal</div>
            <h1>Alles, was dein Projekt jetzt braucht.</h1>
            <p className="lead">Sieh auf einen Blick, was noch benötigt wird, lade Material direkt an der richtigen Stelle hoch und verfolge den Projektfortschritt.</p>
            <p className="signed-in-as">Angemeldet als {user.email}</p>
          </div>

          <aside className="help-card" aria-labelledby="portal-help-title">
            <div className="help-card-title"><HelpCircle size={20} aria-hidden="true" /><div><div className="eyebrow">Kurz erklärt</div><h2 id="portal-help-title">So funktioniert es</h2></div></div>
            <p>Wenn ich noch Material brauche, erscheint es unten als konkrete Anforderung. Du kannst Dateien direkt dazu hochladen und optional eine Notiz ergänzen.</p>
            <div className="help-steps">
              <div><CircleDot size={17} aria-hidden="true" /><span>Prüfe zuerst „Benötigte Inhalte“.</span></div>
              <div><UploadCloud size={17} aria-hidden="true" /><span>Lade eine oder mehrere Dateien hoch.</span></div>
              <div><MessageSquare size={17} aria-hidden="true" /><span>Ich werde automatisch benachrichtigt; du erhältst eine Bestätigung.</span></div>
            </div>
          </aside>
        </section>

        {loadError ? <div className="portal-warning" role="alert">Ein Teil der Projektdaten konnte nicht geladen werden. Bitte Seite neu laden.</div> : null}

        <section className="requests-section" id="anforderungen" aria-labelledby="requests-title">
          <div className="section-heading">
            <div><div className="eyebrow">Nächster Schritt</div><h2 id="requests-title">Was ich noch von dir brauche</h2></div>
            <span className="badge">{openRequests.length} offen</span>
          </div>

          {openRequests.length === 0 ? (
            <div className="request-empty-success"><CheckCircle2 size={20} aria-hidden="true" /><div><strong>Aktuell nichts offen.</strong><span>Im Moment benötige ich keine weiteren Unterlagen von dir.</span></div></div>
          ) : (
            <div className="request-list">
              {openRequests.map((request) => (
                <article className="request-card" key={request.id}>
                  <div className="request-card-head">
                    <div><span className={`request-status request-status-${request.status}`}>{requestLabels[request.status] ?? request.status}</span><h3>{request.title}</h3><p className="request-project">{request.projectName}</p></div>
                    {request.status === "open" ? <a className="primary-button button-link" href={`?request=${encodeURIComponent(request.id)}#upload`}>Dateien dazu hochladen</a> : <a className="secondary-button button-link" href={`?request=${encodeURIComponent(request.id)}#upload`}>Weitere Datei hinzufügen</a>}
                  </div>
                  {request.description ? <p className="request-description">{request.description}</p> : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="project-status-section" id="projektstatus" aria-labelledby="project-status-title">
          <div className="section-heading"><div><div className="eyebrow">Projektfortschritt</div><h2 id="project-status-title">Aktuelle Phase</h2></div></div>
          {projectList.length === 0 ? <div className="empty-state">Dir ist noch kein Projekt zugeordnet.</div> : (
            <div className="project-status-grid">
              {projectList.map((project) => {
                const currentIndex = Math.max(0, phaseOrder.indexOf(project.phase));
                return (
                  <article className="project-status-card" key={project.id}>
                    <div className="project-status-head"><div><strong>{project.name}</strong><span>Zuletzt aktualisiert: {formatDate(project.updated_at)}</span></div><span className="phase-pill">{phaseLabels[project.phase] ?? project.phase}</span></div>
                    <ol className="phase-track" aria-label={`Projektfortschritt: ${phaseLabels[project.phase] ?? project.phase}`}>
                      {phaseOrder.map((phase, index) => (
                        <li key={phase} className={index <= currentIndex ? "phase-step active" : "phase-step"} aria-current={index === currentIndex ? "step" : undefined}>
                          <span className="sr-only">{phaseLabels[phase]}{index === currentIndex ? " – aktuelle Phase" : index < currentIndex ? " – abgeschlossen" : " – ausstehend"}</span>
                        </li>
                      ))}
                    </ol>
                    {project.phase_note ? <p className="phase-note">{project.phase_note}</p> : <p className="muted phase-note">Sobald es ein Update gibt, erscheint der aktuelle Hinweis hier.</p>}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <UploadPanel projects={compactProjects} requests={compactRequests} initialRequestId={requestedUploadId} />

        <section className="card-grid category-grid" aria-label="Unterstützte Dateibereiche">
          {areas.map(({ key, title, description, icon: Icon }) => <article className="card category-card" key={key}><div className="card-icon" aria-hidden="true"><Icon size={21} strokeWidth={1.8} /></div><h2>{title}</h2><p>{description}</p></article>)}
        </section>

        <section className="files-section" id="dateien" aria-labelledby="files-title">
          <div className="section-heading"><div><div className="eyebrow">Projektdateien</div><h2 id="files-title">Zuletzt hochgeladen</h2></div><span className="badge">{fileList.length} Dateien</span></div>
          {uploadGroups.length === 0 ? <div className="empty-state">Noch keine Dateien vorhanden.</div> : (
            <div className="upload-history">{uploadGroups.map((group) => (
              <article className="upload-history-group" key={group.id}>
                <div className="upload-group-header"><div><strong>{group.projectName}</strong><span>{categoryLabels[group.category] ?? "Sonstiges"} · {formatDate(group.createdAt)}</span></div><span className="badge">{group.files.length} {group.files.length === 1 ? "Datei" : "Dateien"}</span></div>
                {group.note ? <p className="upload-note"><strong>Notiz:</strong> {group.note}</p> : null}
                <div className="file-list">{group.files.map((file) => <div className="file-row" key={file.id}><div><strong>{file.file_name}</strong><span>{formatBytes(file.size_bytes)}</span></div>{file.signedUrl ? <a className="secondary-button button-link" href={file.signedUrl}>Herunterladen</a> : <span className="muted">Nicht verfügbar</span>}</div>)}</div>
              </article>
            ))}</div>
          )}
        </section>

        <MessagePanel projects={compactProjects} />

        <section className="messages-history" aria-labelledby="messages-title">
          <div className="section-heading"><div><div className="eyebrow">Kommunikation</div><h2 id="messages-title">Letzte Nachrichten</h2></div><span className="badge">{messages.length}</span></div>
          {messages.length === 0 ? <div className="empty-state">Noch keine Projektnachrichten vorhanden.</div> : <div className="message-list">{messages.map((message) => <article className="message-item" key={message.id}><div className="message-meta"><strong>{message.senderLabel}</strong><span>{message.projectName} · {formatDate(message.created_at)}</span></div><p>{message.body}</p></article>)}</div>}
        </section>

        <section className="status" aria-label="Sicherheitshinweis"><div><strong>Geschützter Projektraum</strong><span>Dateien liegen in einem privaten Speicher und Downloads werden nur zeitlich begrenzt freigegeben.</span></div><div className="badge"><LayoutDashboard size={14} aria-hidden="true" />Kundenportal</div></section>
      </main>
    </div>
  );
}
