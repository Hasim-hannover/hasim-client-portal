import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderKanban, LogOut, MailPlus, MessageSquare, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/portal/actions";
import { MessagePanel } from "@/app/portal/message-panel";
import { UploadPanel } from "@/app/portal/upload-panel";
import { createProject, inviteClient, updateProjectPhase } from "./actions";
import { SystemStatus } from "./system-status";

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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function AdminPage({ searchParams }: { searchParams?: { message?: string; error?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: ownProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (ownProfile?.role !== "admin") redirect("/portal");

  const [profilesResult, projectsResult, messagesResult, filesResult] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, role, created_at").order("created_at", { ascending: false }),
    supabase.from("projects").select("id, client_id, name, status, phase, phase_note, created_at, updated_at").order("created_at", { ascending: false }),
    supabase.from("project_messages").select("id, project_id, sender_id, body, created_at").order("created_at", { ascending: false }).limit(12),
    supabase.from("project_files").select("id, project_id, file_name, size_bytes, created_at").order("created_at", { ascending: false }).limit(12),
  ]);

  const profiles = profilesResult.data ?? [];
  const clients = profiles.filter((profile) => profile.role === "client");
  const projects = projectsResult.data ?? [];
  const messages = messagesResult.data ?? [];
  const files = filesResult.data ?? [];
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const compactProjects = projects.map(({ id, name }) => ({ id, name }));

  return (
    <div className="portal-shell admin-shell">
      <aside className="sidebar">
        <div className="brand">Hasim Client Portal</div>
        <nav className="nav" aria-label="Admin Navigation">
          <a className="nav-item active" href="#overview">Übersicht</a>
          <a className="nav-item" href="#system">System</a>
          <a className="nav-item" href="#clients">Kunden</a>
          <a className="nav-item" href="#projects">Projekte</a>
          <a className="nav-item" href="#communication">Kommunikation</a>
          <Link className="nav-item" href="/portal">Kundenansicht</Link>
        </nav>
        <form action={logout} className="logout-form">
          <button type="submit" className="logout-button"><LogOut size={16} />Abmelden</button>
        </form>
      </aside>

      <main className="main admin-main" id="overview">
        <div className="eyebrow">Backend</div>
        <h1>Kunden und Projekte steuern.</h1>
        <p className="lead">Kunden einladen, Projekte anlegen, Projektphasen aktualisieren, Dateien bereitstellen und Nachrichten senden.</p>

        {searchParams?.message ? <div className="form-success">{searchParams.message}</div> : null}
        {searchParams?.error ? <div className="portal-warning">{searchParams.error}</div> : null}

        <section className="admin-stat-grid" aria-label="Portal Kennzahlen">
          <article className="admin-stat-card"><Users size={19} /><strong>{clients.length}</strong><span>Kunden</span></article>
          <article className="admin-stat-card"><FolderKanban size={19} /><strong>{projects.length}</strong><span>Projekte</span></article>
          <article className="admin-stat-card"><MessageSquare size={19} /><strong>{messages.length}</strong><span>letzte Nachrichten</span></article>
          <article className="admin-stat-card"><MailPlus size={19} /><strong>{files.length}</strong><span>letzte Dateien</span></article>
        </section>

        <SystemStatus />

        <section className="admin-grid" id="clients">
          <article className="admin-panel">
            <div className="section-heading compact-heading"><div><div className="eyebrow">Kundenverwaltung</div><h2>Neuen Kunden einladen</h2></div></div>
            <form action={inviteClient} className="admin-form">
              <label>Name<input name="fullName" required placeholder="Max Mustermann" /></label>
              <label>E-Mail<input name="email" type="email" required placeholder="kunde@example.de" /></label>
              <label>Erstes Projekt <span className="optional-label">optional</span><input name="projectName" placeholder="Website Relaunch" /></label>
              <button className="primary-button" type="submit">Einladung senden</button>
            </form>
          </article>

          <article className="admin-panel">
            <div className="section-heading compact-heading"><div><div className="eyebrow">Bestand</div><h2>Kunden</h2></div><span className="badge">{clients.length}</span></div>
            {clients.length === 0 ? <div className="empty-state">Noch keine Kundenkonten angelegt.</div> : (
              <div className="admin-list">{clients.map((client) => <div className="admin-list-row" key={client.id}><div><strong>{client.full_name || "Ohne Namen"}</strong><span>{client.email || "Keine E-Mail"}</span></div><span className="badge">{projects.filter((project) => project.client_id === client.id).length} Projekte</span></div>)}</div>
            )}
          </article>
        </section>

        <section className="admin-panel" id="projects">
          <div className="section-heading"><div><div className="eyebrow">Projektsteuerung</div><h2>Projekte & aktuelle Phase</h2></div><span className="badge">{projects.length}</span></div>
          {clients.length ? <form action={createProject} className="admin-create-project-form"><label>Kunde<select name="clientId" required>{clients.map((client) => <option key={client.id} value={client.id}>{client.full_name || client.email}</option>)}</select></label><label>Projektname<input name="name" required placeholder="Website Relaunch" /></label><button className="secondary-button" type="submit">Projekt anlegen</button></form> : null}
          {projects.length === 0 ? <div className="empty-state">Noch keine Projekte vorhanden.</div> : (
            <div className="admin-project-list">{projects.map((project) => {
              const client = profileById.get(project.client_id);
              return <article className="admin-project-card" key={project.id}><div className="admin-project-head"><div><strong>{project.name}</strong><span>{client?.full_name || client?.email || "Kunde"} · aktualisiert {formatDate(project.updated_at)}</span></div><span className="phase-pill">{phaseLabels[project.phase] ?? project.phase}</span></div><form action={updateProjectPhase} className="admin-phase-form"><input type="hidden" name="projectId" value={project.id} /><label>Phase<select name="phase" defaultValue={project.phase}>{phases.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="admin-phase-note">Hinweis für den Kunden<textarea name="phaseNote" rows={3} maxLength={1200} defaultValue={project.phase_note ?? ""} placeholder="Zum Beispiel: Inhalte sind vollständig, Umsetzung startet diese Woche." /></label><button className="primary-button" type="submit">Phase speichern</button></form></article>;
            })}</div>
          )}
        </section>

        <section className="admin-grid" id="communication"><UploadPanel projects={compactProjects} /><MessagePanel projects={compactProjects} /></section>

        <section className="admin-grid">
          <article className="admin-panel"><div className="section-heading compact-heading"><div><div className="eyebrow">Aktivität</div><h2>Letzte Nachrichten</h2></div></div>{messages.length === 0 ? <div className="empty-state">Keine Nachrichten.</div> : <div className="admin-list">{messages.map((message) => { const project = projectById.get(message.project_id); const sender = profileById.get(message.sender_id); return <div className="admin-list-row admin-message-row" key={message.id}><div><strong>{sender?.full_name || sender?.email || "Unbekannt"}</strong><span>{project?.name || "Projekt"} · {formatDate(message.created_at)}</span><p>{message.body}</p></div></div>; })}</div>}</article>
          <article className="admin-panel"><div className="section-heading compact-heading"><div><div className="eyebrow">Aktivität</div><h2>Letzte Dateien</h2></div></div>{files.length === 0 ? <div className="empty-state">Keine Dateien.</div> : <div className="admin-list">{files.map((file) => <div className="admin-list-row" key={file.id}><div><strong>{file.file_name}</strong><span>{projectById.get(file.project_id)?.name || "Projekt"} · {formatDate(file.created_at)}</span></div></div>)}</div>}</article>
        </section>
      </main>
    </div>
  );
}
