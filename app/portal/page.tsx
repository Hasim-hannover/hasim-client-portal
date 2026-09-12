import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { completeInfoAction, logout } from "./actions";
import { ApprovalCard, type ApprovalCardAction } from "./approval-card";
import { MessagePanel } from "./message-panel";
import { ProjectStartClientPanel } from "./project-start-client-panel";
import { UploadPanel } from "./upload-panel";
import styles from "./portal.module.css";

export const dynamic = "force-dynamic";

const phaseLabels: Record<string, string> = {
  onboarding: "Kick-off & Bestandsaufnahme",
  content: "Design & Inhalte",
  concept: "Konzept & Leitseiten",
  development: "Entwicklung",
  review: "Qualitätssicherung & Abnahme",
  launch: "Livegang & Übergabe",
  completed: "Abgeschlossen",
};

const phaseOrder = ["onboarding", "content", "concept", "development", "review", "launch", "completed"];
const actionTypeLabels: Record<string, string> = {
  upload: "Bereitstellen",
  approval: "Entscheiden",
  info: "Bestätigen",
};

function needsClientAction(action: { action_type: string; status: string }) {
  if (action.action_type === "upload") return ["open", "changes_requested"].includes(action.status);
  if (action.action_type === "approval" || action.action_type === "info") return action.status === "open";
  return action.status === "open";
}

function waitsForOwner(action: { action_type: string; status: string }) {
  if (action.status === "submitted") return true;
  return action.action_type === "approval" && action.status === "changes_requested";
}

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatShortDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(value));
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "–";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

  const [profileResult, projectsResult, actionsResult, filesResult, eventsResult] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", user.id).single(),
    supabase.from("projects").select("id, name, status, phase, phase_note, started_at, updated_at").order("created_at", { ascending: false }),
    supabase.from("project_actions").select("id, project_id, title, description, action_type, status, due_at, response_note, phase_key, version_label, demo_url, preview_image_url, blocks_progress, demo_auth_type, created_at, updated_at").order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
    supabase.from("project_files").select("id, project_id, action_id, upload_id, category, note, file_name, storage_path, mime_type, size_bytes, created_at").order("created_at", { ascending: false }).limit(80),
    supabase.from("project_events").select("id, project_id, actor_id, event_type, title, body, created_at").order("created_at", { ascending: false }).limit(40),
  ]);

  const profile = profileResult.data;
  const projects = projectsResult.data ?? [];
  const activeProject = projects[0] ?? null;
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));
  const actionList = (actionsResult.data ?? []).map((action) => ({
    ...action,
    projectName: projectNames.get(action.project_id) ?? "Projekt",
  }));
  const clientActions = actionList.filter(needsClientAction);
  const waitingActions = actionList.filter(waitsForOwner);
  const primaryAction = clientActions[0] ?? null;
  const waitingAction = waitingActions[0] ?? null;
  const currentPhaseIndex = activeProject ? Math.max(0, phaseOrder.indexOf(activeProject.phase)) : 0;

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

  const files = rawFiles.map((file) => ({
    ...file,
    projectName: projectNames.get(file.project_id) ?? "Projekt",
    signedUrl: signedByPath.get(file.storage_path) ?? null,
  }));

  const events = (eventsResult.data ?? []).map((event) => ({
    ...event,
    projectName: projectNames.get(event.project_id) ?? "Projekt",
  }));

  const compactProjects = projects.map(({ id, name }) => ({ id, name }));
  const compactActions = actionList.map((action) => ({
    id: action.id,
    projectId: action.project_id,
    title: action.title,
    type: action.action_type as "upload" | "approval" | "info",
    status: action.status,
  }));

  const firstName = profile?.full_name?.split(" ")[0] || "";
  const nextStateTitle = primaryAction ? "Du bist am Zug." : waitingAction ? "Wir sind am Zug." : "Alles auf Kurs.";
  const nextStateCopy = primaryAction
    ? primaryAction.description || "Diese Aufgabe ist der nächste sinnvolle Schritt im Projekt."
    : waitingAction
      ? `„${waitingAction.title}“ ist eingegangen. Wir kümmern uns um den nächsten Schritt.`
      : "Im Moment ist nichts von dir erforderlich.";

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} aria-label="WERK Navigation">
        <div className={styles.brand}>
          <strong>WERK</strong>
          <span>Klientenportal</span>
        </div>

        <nav className={styles.nav} aria-label="Projektbereiche">
          <a href="#projekt">Projekt</a>
          <a href="#aufgaben">Aufgaben</a>
          <a href="#dateien">Dateien</a>
          <a href="#verlauf">Verlauf</a>
        </nav>

        <div className={styles.account}>
          <span>{profile?.email || user.email}</span>
          <form action={logout}>
            <button className={styles.logout} type="submit">Abmelden</button>
          </form>
        </div>
      </aside>

      <main className={styles.main} id="main-content">
        <header className={styles.topline}>
          <div>
            <p className={styles.kicker}>WERK / Projektbereich</p>
            <h1>{firstName ? `Hallo ${firstName}.` : "Willkommen."}</h1>
          </div>
          <div className={styles.projectMeta}>
            <span>Aktives Projekt</span>
            <strong>{activeProject?.name || "Noch kein Projekt"}</strong>
          </div>
        </header>

        <section id="projekt" aria-labelledby="project-state-title">
          <div className={styles.focusGrid}>
            <article className={styles.projectState}>
              <span className={styles.phaseLabel}>{activeProject ? phaseLabels[activeProject.phase] ?? activeProject.phase : "Projekt wird vorbereitet"}</span>
              <h2 id="project-state-title">{activeProject?.name || "Dein Projektraum wird vorbereitet."}</h2>
              <p>{activeProject?.phase_note || "Hier steht immer der aktuelle Projektzustand – klar, knapp und ohne unnötige Ablenkung."}</p>

              {activeProject?.started_at ? (
                <ol className={styles.phaseTrack} aria-label={`Projektfortschritt: ${phaseLabels[activeProject.phase] ?? activeProject.phase}`}>
                  {phaseOrder.map((phase, index) => (
                    <li key={phase} data-active={index <= currentPhaseIndex ? "true" : "false"} aria-current={index === currentPhaseIndex ? "step" : undefined}>
                      <span className="sr-only">{phaseLabels[phase]}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </article>

            <article className={styles.nextCard}>
              <div>
                <p className={styles.kicker}>{primaryAction ? "Nächster Schritt" : waitingAction ? "Aktueller Stand" : "Projektstatus"}</p>
                <h3>{nextStateTitle}</h3>
                <p>{nextStateCopy}</p>
                {primaryAction ? (
                  <div className={styles.nextMeta}>
                    <span>{actionTypeLabels[primaryAction.action_type] ?? primaryAction.action_type}</span>
                    <span>{primaryAction.title}</span>
                    {primaryAction.due_at ? <span>bis {formatShortDate(primaryAction.due_at)}</span> : null}
                  </div>
                ) : null}
              </div>

              {primaryAction ? <a className={styles.nextActionLink} href={`#action-${primaryAction.id}`}>Jetzt ansehen</a> : (
                <div className={styles.calmState}>
                  <strong>{waitingAction ? "Dein Teil ist erledigt." : "Keine offene Aktion."}</strong>
                  <span>{waitingAction ? "Sobald es weitergeht, erscheint der nächste Schritt hier." : "Du musst aktuell nichts tun."}</span>
                </div>
              )}
            </article>
          </div>

          {activeProject ? (
            <div className={styles.startWrap}>
              <ProjectStartClientPanel projectId={activeProject.id} projectName={activeProject.name} startedAt={activeProject.started_at} />
            </div>
          ) : null}
        </section>

        <section className={styles.section} id="aufgaben" aria-labelledby="tasks-title">
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.kicker}>Handlungen & Entscheidungen</p>
              <h2 id="tasks-title">Aufgaben</h2>
            </div>
            <p>Alles, was von dir benötigt wird: bereitstellen, bestätigen oder freigeben.</p>
          </div>

          {clientActions.length === 0 ? <div className={styles.empty}>Aktuell ist nichts von dir offen.</div> : (
            <div className={styles.taskList}>
              {clientActions.map((action) => action.action_type === "approval" ? (
                <div className={styles.approvalWrap} key={action.id}>
                  <ApprovalCard action={action as ApprovalCardAction} />
                </div>
              ) : (
                <article className={styles.simpleTask} id={`action-${action.id}`} key={action.id}>
                  <div>
                    <span className={styles.taskType}>{actionTypeLabels[action.action_type] ?? action.action_type}</span>
                    <h3>{action.title}</h3>
                    {action.description ? <p>{action.description}</p> : null}
                    {action.due_at ? <p>Rückmeldung bis {formatShortDate(action.due_at)}</p> : null}

                    {action.action_type === "info" ? (
                      <form action={completeInfoAction} className="approval-form compact-action-form">
                        <input type="hidden" name="actionId" value={action.id} />
                        <label htmlFor={`info-note-${action.id}`}>Antwort <span className="optional-label">optional</span></label>
                        <textarea id={`info-note-${action.id}`} name="note" rows={3} maxLength={2000} placeholder="Kurze Rückmeldung …" />
                        <button className="primary-button" type="submit">Bestätigen</button>
                      </form>
                    ) : null}
                  </div>

                  {action.action_type === "upload" ? <a className={styles.taskLink} href={`?action=${encodeURIComponent(action.id)}#upload`}>Dateien bereitstellen →</a> : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className={styles.section} id="dateien" aria-labelledby="files-title">
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.kicker}>Projektmaterial</p>
              <h2 id="files-title">Dateien</h2>
            </div>
            <p>Projektdateien bleiben privat und werden nur über zeitlich begrenzte Links geöffnet.</p>
          </div>

          <div className={styles.uploadWrap}>
            <UploadPanel projects={compactProjects} actions={compactActions} initialActionId={requestedActionId} />
          </div>

          {files.length === 0 ? <div className={styles.empty}>Noch keine Dateien vorhanden.</div> : (
            <div className={styles.fileList}>
              {files.slice(0, 30).map((file) => (
                <div className={styles.fileRow} key={file.id}>
                  <div>
                    <strong>{file.file_name}</strong>
                    <span>{file.projectName} · {formatBytes(file.size_bytes)} · {formatDate(file.created_at)}</span>
                  </div>
                  {file.signedUrl ? <a href={file.signedUrl} target="_blank" rel="noreferrer">Öffnen ↗</a> : null}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.section} id="verlauf" aria-labelledby="history-title">
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.kicker}>Dokumentierte Projektakte</p>
              <h2 id="history-title">Verlauf</h2>
            </div>
            <p>Nachrichten, Uploads, Freigaben und Statusänderungen bleiben im Projektkontext nachvollziehbar.</p>
          </div>

          <div className={styles.messageWrap}>
            <MessagePanel projects={compactProjects} />
          </div>

          {events.length === 0 ? <div className={styles.empty}>Noch keine Aktivität vorhanden.</div> : (
            <div className={styles.timeline}>
              {events.map((event) => (
                <div className={styles.timelineItem} key={event.id}>
                  <time dateTime={event.created_at}>{formatDate(event.created_at)}</time>
                  <div>
                    <strong>{event.title}</strong>
                    <span>{event.projectName}</span>
                    {event.body ? <p>{event.body}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
