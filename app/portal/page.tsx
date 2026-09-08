import {
  Bell,
  CheckCircle2,
  Clock3,
  FileArchive,
  FileText,
  Image,
  LayoutDashboard,
  LogOut,
  Sparkles,
  Video,
} from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  completeInfoAction,
  logout,
  markAllNotificationsRead,
  markNotificationRead,
  respondToApproval,
} from "./actions";
import { MessagePanel } from "./message-panel";
import { UploadPanel } from "./upload-panel";

export const dynamic = "force-dynamic";

const areas = [
  { key: "image", title: "Bilder & Grafiken", icon: Image },
  { key: "document", title: "Dokumente & PDF", icon: FileText },
  { key: "video", title: "Videos", icon: Video },
  { key: "other", title: "Sonstiges", icon: FileArchive },
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
const actionTypeLabels: Record<string, string> = { upload: "Upload", approval: "Freigabe", info: "Bestätigung" };
const actionStatusLabels: Record<string, string> = {
  open: "Offen",
  submitted: "Eingereicht",
  approved: "Freigegeben",
  changes_requested: "Änderungen gewünscht",
  done: "Erledigt",
};

type ActionState = { action_type: string; status: string };

function needsClientAction(action: ActionState) {
  if (action.action_type === "upload") return ["open", "changes_requested"].includes(action.status);
  if (action.action_type === "approval" || action.action_type === "info") return action.status === "open";
  return action.status === "open";
}

function waitsForOwner(action: ActionState) {
  if (action.status === "submitted") return true;
  return action.action_type === "approval" && action.status === "changes_requested";
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "–";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatShortDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(value));
}

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string | string[] }>;
}) {
  const query = await searchParams;
  const requestedActionId = firstSearchValue(query.action);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileResult, projectsResult, actionsResult, filesResult, messagesResult, eventsResult, notificationsResult] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", user.id).single(),
    supabase.from("projects").select("id, name, status, phase, phase_note, updated_at").order("created_at", { ascending: false }),
    supabase.from("project_actions").select("id, project_id, title, description, action_type, status, due_at, response_note, created_at, updated_at").order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
    supabase.from("project_files").select("id, project_id, action_id, upload_id, category, note, file_name, storage_path, mime_type, size_bytes, created_at").order("created_at", { ascending: false }).limit(80),
    supabase.from("project_messages").select("id, project_id, sender_id, body, created_at").order("created_at", { ascending: false }).limit(20),
    supabase.from("project_events").select("id, project_id, actor_id, event_type, title, body, created_at").order("created_at", { ascending: false }).limit(24),
    supabase.from("portal_notifications").select("id, project_id, title, body, read_at, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(12),
  ]);

  const projectList = projectsResult.data ?? [];
  const projectNames = new Map(projectList.map((project) => [project.id, project.name]));
  const actionList = (actionsResult.data ?? []).map((action) => ({ ...action, projectName: projectNames.get(action.project_id) ?? "Projekt" }));
  const clientActions = actionList.filter(needsClientAction);
  const waitingActions = actionList.filter(waitsForOwner);
  const activeProject = projectList[0] ?? null;
  const primaryAction = clientActions[0] ?? null;
  const waitingAction = waitingActions[0] ?? null;
  const profile = profileResult.data;
  const notifications = notificationsResult.data ?? [];
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;
  const events = (eventsResult.data ?? []).map((event) => ({ ...event, projectName: projectNames.get(event.project_id) ?? "Projekt" }));

  const rawFiles = filesResult.data ?? [];
  const signedByPath = new Map<string, string>();
  if (rawFiles.length) {
    const { data: signedUrls } = await supabase.storage.from("project-files").createSignedUrls(rawFiles.map((file) => file.storage_path), 60 * 10);
    signedUrls?.forEach((item) => {
      if (item.signedUrl && item.path) signedByPath.set(item.path, item.signedUrl);
    });
  }

  const fileList = rawFiles.map((file) => {
    const signedUrl = signedByPath.get(file.storage_path) ?? null;
    const downloadUrl = signedUrl ? `${signedUrl}${signedUrl.includes("?") ? "&" : "?"}download=${encodeURIComponent(file.file_name)}` : null;
    return { ...file, signedUrl: downloadUrl, projectName: projectNames.get(file.project_id) ?? "Projekt" };
  });

  const messages = (messagesResult.data ?? []).map((message) => ({
    ...message,
    projectName: projectNames.get(message.project_id) ?? "Projekt",
    senderLabel: message.sender_id === user.id ? "Du" : "Hasim Üner",
  }));

  const compactProjects = projectList.map(({ id, name }) => ({ id, name }));
  const compactActions = actionList.map((action) => ({
    id: action.id,
    projectId: action.project_id,
    title: action.title,
    type: action.action_type as "upload" | "approval" | "info",
    status: action.status,
  }));
  const loadError = projectsResult.error ?? actionsResult.error ?? filesResult.error ?? messagesResult.error ?? eventsResult.error;
  const currentPhaseIndex = activeProject ? Math.max(0, phaseOrder.indexOf(activeProject.phase)) : 0;

  return (
    <div className="portal-shell portal-v2-shell">
      <a className="skip-link" href="#main-content">Zum Inhalt springen</a>
      <aside className="sidebar" aria-label="Kundenportal Navigation">
        <div className="brand">Hasim Client Portal</div>
        <nav className="nav" aria-label="Portal Navigation">
          <a className="nav-item active" href="#dashboard" aria-current="location">Übersicht</a>
          <a className="nav-item" href="#aktionen">Deine Aufgaben</a>
          <a className="nav-item" href="#aktivitaet">Aktivität</a>
          <a className="nav-item" href="#dateien">Dateien</a>
          <a className="nav-item" href="#nachrichten">Nachrichten</a>
        </nav>
        <form action={logout} className="logout-form">
          <button type="submit" className="logout-button"><LogOut size={16} aria-hidden="true" />Abmelden</button>
        </form>
      </aside>

      <main className="main portal-v2-main" id="main-content">
        <header className="workspace-topbar" id="dashboard">
          <div>
            <div className="eyebrow">Client Workspace</div>
            <h1>{profile?.full_name ? `Hallo ${profile.full_name.split(" ")[0]}.` : "Willkommen im Projekt."}</h1>
            <p className="lead">Hier siehst du nur das, was für den nächsten Projektschritt relevant ist.</p>
          </div>
          <div className="workspace-topbar-actions">
            <div className="notification-indicator" aria-label={`${unreadCount} ungelesene Benachrichtigungen`}><Bell size={18} aria-hidden="true" /><span>{unreadCount}</span></div>
            <span className="signed-in-as">{profile?.email || user.email}</span>
          </div>
        </header>

        {loadError ? <div className="portal-warning" role="alert">Ein Teil der Projektdaten konnte nicht geladen werden. Bitte Seite neu laden.</div> : null}

        <section className="client-focus-grid" aria-label="Aktueller Projektfokus">
          <article className="client-focus-card primary-focus-card">
            <div className="focus-card-topline"><span className="status-dot" aria-hidden="true" /><span>{activeProject ? phaseLabels[activeProject.phase] ?? activeProject.phase : "Noch kein Projekt"}</span></div>
            <h2>{activeProject?.name || "Dein Projekt wird vorbereitet"}</h2>
            <p>{activeProject?.phase_note || "Sobald es ein Projektupdate gibt, erscheint hier der aktuelle Stand."}</p>
            {activeProject ? (
              <ol className="phase-track premium-phase-track" aria-label={`Projektfortschritt: ${phaseLabels[activeProject.phase] ?? activeProject.phase}`}>
                {phaseOrder.map((phase, index) => <li key={phase} className={index <= currentPhaseIndex ? "phase-step active" : "phase-step"} aria-current={index === currentPhaseIndex ? "step" : undefined}><span className="sr-only">{phaseLabels[phase]}</span></li>)}
              </ol>
            ) : null}
          </article>

          <article className="client-focus-card next-action-card">
            <div className="eyebrow">{primaryAction ? "Nächster Schritt" : waitingAction ? "Bei uns in Bearbeitung" : "Aktueller Stand"}</div>
            {primaryAction ? <>
              <div className="action-type-row"><span className="action-type-pill">{actionTypeLabels[primaryAction.action_type]}</span>{primaryAction.due_at ? <span className="action-due"><Clock3 size={14} aria-hidden="true" />bis {formatShortDate(primaryAction.due_at)}</span> : null}</div>
              <h2>{primaryAction.title}</h2>
              <p>{primaryAction.description || "Diese Aufgabe ist der nächste sinnvolle Schritt im Projekt."}</p>
              <a className="primary-button button-link" href={`#action-${primaryAction.id}`}>Jetzt erledigen</a>
            </> : waitingAction ? (
              <div className="request-empty-success"><CheckCircle2 size={20} aria-hidden="true" /><div><strong>Dein Teil ist erledigt.</strong><span>{waitingAction.action_type === "approval" && waitingAction.status === "changes_requested" ? "Dein Änderungswunsch ist angekommen. Wir kümmern uns darum und melden uns mit dem nächsten Stand." : `„${waitingAction.title}“ wurde eingereicht. Wir prüfen das und melden uns, sobald es weitergeht.`}</span></div></div>
            ) : <div className="request-empty-success"><CheckCircle2 size={20} aria-hidden="true" /><div><strong>Du bist auf dem aktuellen Stand.</strong><span>Im Moment ist nichts von dir erforderlich.</span></div></div>}
          </article>
        </section>

        <section className="client-actions-section" id="aktionen" aria-labelledby="actions-title">
          <div className="section-heading">
            <div><div className="eyebrow">Deine nächsten Schritte</div><h2 id="actions-title">Was jetzt von dir gebraucht wird</h2></div>
            <span className="badge">{clientActions.length} offen</span>
          </div>

          {clientActions.length === 0 ? (
            <div className="request-empty-success"><CheckCircle2 size={20} aria-hidden="true" /><div><strong>{waitingActions.length ? "Von dir ist gerade nichts offen." : "Alles erledigt."}</strong><span>{waitingActions.length ? "Wir sind am Zug. Sobald wir wieder etwas von dir brauchen, erscheint es hier." : "Du musst aktuell nichts tun."}</span></div></div>
          ) : (
            <div className="client-action-list">
              {clientActions.map((action) => (
                <article className={`client-action-card action-${action.action_type}`} id={`action-${action.id}`} key={action.id}>
                  <div className="client-action-card-head">
                    <div>
                      <div className="action-type-row"><span className="action-type-pill">{actionTypeLabels[action.action_type]}</span><span className={`action-status action-status-${action.status}`}>{actionStatusLabels[action.status] ?? action.status}</span></div>
                      <h3>{action.title}</h3>
                      <p className="request-project">{action.projectName}{action.due_at ? ` · bis ${formatShortDate(action.due_at)}` : ""}</p>
                    </div>
                    {action.action_type === "upload" ? <a className="primary-button button-link" href={`?action=${encodeURIComponent(action.id)}#upload`}>Dateien hochladen</a> : null}
                  </div>
                  {action.description ? <p className="request-description">{action.description}</p> : null}

                  {action.action_type === "approval" ? (
                    <form action={respondToApproval} className="approval-form">
                      <input type="hidden" name="actionId" value={action.id} />
                      <label htmlFor={`approval-note-${action.id}`}>Feedback <span className="optional-label">optional</span></label>
                      <textarea id={`approval-note-${action.id}`} name="note" rows={3} maxLength={2000} placeholder="Falls du Änderungen möchtest, beschreibe sie hier kurz." defaultValue={action.response_note ?? ""} />
                      <div className="approval-actions">
                        <button className="secondary-button" type="submit" name="decision" value="changes_requested">Änderungen erforderlich</button>
                        <button className="primary-button" type="submit" name="decision" value="approved">Freigeben</button>
                      </div>
                    </form>
                  ) : null}

                  {action.action_type === "info" ? (
                    <form action={completeInfoAction} className="approval-form compact-action-form">
                      <input type="hidden" name="actionId" value={action.id} />
                      <label htmlFor={`info-note-${action.id}`}>Antwort <span className="optional-label">optional</span></label>
                      <textarea id={`info-note-${action.id}`} name="note" rows={2} maxLength={2000} placeholder="Optionaler Hinweis" />
                      <button className="primary-button" type="submit">Als erledigt bestätigen</button>
                    </form>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <UploadPanel projects={compactProjects} actions={compactActions} initialActionId={requestedActionId} />

        <section className="activity-notification-grid" id="aktivitaet">
          <article className="workspace-panel">
            <div className="section-heading compact-heading"><div><div className="eyebrow">Neu seit dem letzten Besuch</div><h2>Aktivität</h2></div><Sparkles size={18} aria-hidden="true" /></div>
            {events.length === 0 ? <div className="empty-state compact-empty">Noch keine Aktivität vorhanden.</div> : (
              <div className="timeline-list">{events.slice(0, 10).map((event) => <div className="timeline-item" key={event.id}><span className="timeline-dot" aria-hidden="true" /><div><strong>{event.title}</strong><span>{event.projectName} · {formatDate(event.created_at)}</span>{event.body ? <p>{event.body}</p> : null}</div></div>)}</div>
            )}
          </article>

          <article className="workspace-panel">
            <div className="section-heading compact-heading"><div><div className="eyebrow">Benachrichtigungen</div><h2>Updates</h2></div><span className="badge">{unreadCount} neu</span></div>
            {notifications.length === 0 ? <div className="empty-state compact-empty">Keine Benachrichtigungen.</div> : <div className="notification-list">{notifications.slice(0, 8).map((notification) => (
              <div className={notification.read_at ? "notification-row" : "notification-row is-unread"} key={notification.id}>
                <div><strong>{notification.title}</strong><span>{formatDate(notification.created_at)}</span>{notification.body ? <p>{notification.body}</p> : null}</div>
                {!notification.read_at ? <form action={markNotificationRead}><input type="hidden" name="notificationId" value={notification.id} /><button className="text-button" type="submit">Gelesen</button></form> : null}
              </div>
            ))}</div>}
            {unreadCount ? <form action={markAllNotificationsRead} className="notification-read-all"><button className="secondary-button" type="submit">Alle als gelesen markieren</button></form> : null}
          </article>
        </section>

        <section className="files-section" id="dateien" aria-labelledby="files-title">
          <div className="section-heading"><div><div className="eyebrow">Projektdateien</div><h2 id="files-title">Dateien</h2></div><span className="badge">{fileList.length}</span></div>
          <div className="file-category-strip" aria-label="Dateikategorien">{areas.map(({ key, title, icon: Icon }) => <span key={key}><Icon size={15} aria-hidden="true" />{title}</span>)}</div>
          {fileList.length === 0 ? <div className="empty-state">Noch keine Dateien vorhanden.</div> : (
            <div className="file-manager-list">{fileList.slice(0, 30).map((file) => <div className="file-manager-row" key={file.id}><div className="file-manager-icon"><FileText size={18} aria-hidden="true" /></div><div className="file-manager-main"><strong>{file.file_name}</strong><span>{file.projectName} · {categoryLabels[file.category] ?? "Sonstiges"} · {formatBytes(file.size_bytes)} · {formatDate(file.created_at)}</span>{file.note ? <p>{file.note}</p> : null}</div>{file.signedUrl ? <a className="secondary-button button-link" href={file.signedUrl}>Download</a> : null}</div>)}</div>
          )}
        </section>

        <MessagePanel projects={compactProjects} />

        <section className="messages-history" aria-labelledby="messages-title">
          <div className="section-heading"><div><div className="eyebrow">Kommunikation</div><h2 id="messages-title">Letzte Nachrichten</h2></div><span className="badge">{messages.length}</span></div>
          {messages.length === 0 ? <div className="empty-state">Noch keine Projektnachrichten vorhanden.</div> : <div className="message-list">{messages.map((message) => <article className="message-item" key={message.id}><div className="message-meta"><strong>{message.senderLabel}</strong><span>{message.projectName} · {formatDate(message.created_at)}</span></div><p>{message.body}</p></article>)}</div>}
        </section>

        <section className="status" aria-label="Sicherheitshinweis"><div><strong>Geschützter Projektraum</strong><span>Dateien liegen privat und Downloads werden nur zeitlich begrenzt freigegeben.</span></div><div className="badge"><LayoutDashboard size={14} aria-hidden="true" />Client Workspace</div></section>
      </main>
    </div>
  );
}
