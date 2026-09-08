import Link from "next/link";
import { CheckCircle2, Clock3, Inbox, Search, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createClientAction, updateClientActionStatus } from "./action-workflows";

const typeLabels: Record<string, string> = { upload: "Upload", approval: "Freigabe", info: "Bestätigung" };
const statusLabels: Record<string, string> = {
  open: "Offen",
  submitted: "Eingereicht",
  approved: "Freigegeben",
  changes_requested: "Änderungen gewünscht",
  done: "Erledigt",
};

export async function AttentionCenter() {
  const supabase = await createClient();
  const [projectsResult, clientsResult, actionsResult, eventsResult] = await Promise.all([
    supabase.from("projects").select("id, client_id, name, phase, status, updated_at").order("updated_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, company_name, email, client_number").eq("role", "client"),
    supabase.from("project_actions").select("id, project_id, title, action_type, status, due_at, response_note, updated_at, created_at").order("updated_at", { ascending: false }),
    supabase.from("project_events").select("id, project_id, event_type, title, body, created_at").order("created_at", { ascending: false }).limit(12),
  ]);

  const projects = projectsResult.data ?? [];
  const clients = clientsResult.data ?? [];
  const actions = actionsResult.data ?? [];
  const events = eventsResult.data ?? [];
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const waitingOnClient = actions.filter((action) => ["open", "changes_requested"].includes(action.status));
  const submitted = actions.filter((action) => action.status === "submitted");
  const withDeadline = waitingOnClient.filter((action) => Boolean(action.due_at));
  const attention = [...submitted, ...waitingOnClient.filter((item) => !submitted.some((submittedItem) => submittedItem.id === item.id))].slice(0, 8);

  return (
    <section className="attention-center" id="attention" aria-labelledby="attention-title">
      <div className="section-heading">
        <div><div className="eyebrow">Operations</div><h2 id="attention-title">Was heute Aufmerksamkeit braucht</h2></div>
        <Link className="secondary-button button-link" href="/admin/search"><Search size={16} aria-hidden="true" />Suchen</Link>
      </div>

      <div className="attention-stat-grid">
        <article><Inbox size={18} aria-hidden="true" /><strong>{submitted.length}</strong><span>Eingereicht – prüfen</span></article>
        <article><Clock3 size={18} aria-hidden="true" /><strong>{waitingOnClient.length}</strong><span>Wartet auf Kunde</span></article>
        <article><Clock3 size={18} aria-hidden="true" /><strong>{withDeadline.length}</strong><span>Mit Fälligkeit</span></article>
        <article><Sparkles size={18} aria-hidden="true" /><strong>{events.length}</strong><span>Letzte Aktivitäten</span></article>
      </div>

      <div className="admin-grid attention-work-grid">
        <article className="admin-panel attention-list-panel">
          <div className="section-heading compact-heading"><div><div className="eyebrow">Priorisiert</div><h3>Attention Queue</h3></div><span className="badge">{attention.length}</span></div>
          {attention.length === 0 ? <div className="request-empty-success"><CheckCircle2 size={20} aria-hidden="true" /><div><strong>Keine offenen Blocker.</strong><span>Die aktuellen Projekte sind auf Kurs.</span></div></div> : (
            <div className="attention-list">{attention.map((action) => {
              const project = projectById.get(action.project_id);
              const client = project ? clientById.get(project.client_id) : null;
              return <article className="attention-row" key={action.id}>
                <div className="attention-row-main">
                  <div className="action-type-row"><span className="action-type-pill">{typeLabels[action.action_type] ?? action.action_type}</span><span className={`action-status action-status-${action.status}`}>{statusLabels[action.status] ?? action.status}</span></div>
                  <strong>{action.title}</strong>
                  <span>{client?.company_name || client?.full_name || "Kunde"} · {project?.name || "Projekt"}{action.due_at ? ` · fällig ${new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(action.due_at))}` : ""}</span>
                  {action.response_note ? <p>{action.response_note}</p> : null}
                </div>
                <div className="attention-row-actions">
                  {client ? <Link className="secondary-button button-link" href={`/admin/clients/${client.id}`}>Kundenakte</Link> : null}
                  <form action={updateClientActionStatus}>
                    <input type="hidden" name="actionId" value={action.id} />
                    <input type="hidden" name="status" value={action.status === "submitted" ? "done" : "open"} />
                    <button className="primary-button" type="submit">{action.status === "submitted" ? "Geprüft" : "Zurücksetzen"}</button>
                  </form>
                </div>
              </article>;
            })}</div>
          )}
        </article>

        <article className="admin-panel action-composer-panel">
          <div className="eyebrow">Next Action Engine</div>
          <h3>Neue Kundenaufgabe</h3>
          <p className="admin-hint">Upload, Freigabe oder kurze Bestätigung als klaren nächsten Schritt definieren.</p>
          <form action={createClientAction} className="admin-form">
            <label htmlFor="action-project">Projekt</label>
            <select id="action-project" name="projectId" required>{projects.map((project) => {
              const client = clientById.get(project.client_id);
              return <option key={project.id} value={project.id}>{client?.company_name || client?.full_name || "Kunde"} · {project.name}</option>;
            })}</select>
            <label htmlFor="action-type">Aktion</label>
            <select id="action-type" name="actionType" defaultValue="upload"><option value="upload">Datei hochladen</option><option value="approval">Freigabe erteilen</option><option value="info">Bestätigen / beantworten</option></select>
            <label htmlFor="action-title">Aufgabe</label>
            <input id="action-title" name="title" required maxLength={160} placeholder="z. B. Startseitenentwurf freigeben" />
            <label htmlFor="action-description">Beschreibung <span className="optional-label">optional</span></label>
            <textarea id="action-description" name="description" rows={3} maxLength={2000} placeholder="Kurz erklären, was genau gebraucht wird." />
            <label htmlFor="action-due">Fällig am <span className="optional-label">optional</span></label>
            <input id="action-due" name="dueDate" type="date" />
            <button className="primary-button" type="submit">Aufgabe an Kunden senden</button>
          </form>
        </article>
      </div>
    </section>
  );
}
