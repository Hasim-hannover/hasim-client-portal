import { CheckCircle2, CircleDot, ExternalLink, GitPullRequestDraft, History, LockKeyhole } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ApprovalComposer } from "./approval-composer";

type ProjectRow = { id: string; name: string; phase: string };
type ApprovalRow = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: string;
  due_at: string | null;
  response_note: string | null;
  phase_key: string | null;
  version_label: string | null;
  demo_url: string | null;
  preview_image_url: string | null;
  blocks_progress: boolean;
  demo_auth_type: string;
  created_at: string;
  updated_at: string;
};

const phaseLabels: Record<string, string> = {
  onboarding: "Kick-off & Bestandsaufnahme",
  content: "Design & Inhalte",
  concept: "Konzept & Leitseiten",
  development: "Entwicklung",
  review: "Qualitätssicherung & Abnahme",
  launch: "Livegang & Übergabe",
  completed: "Abgeschlossen",
};

const statusLabels: Record<string, string> = {
  open: "Freigabe offen",
  approved: "Freigegeben",
  changes_requested: "Änderungen angefordert",
};

function formatDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export async function ApprovalAdminPanel({ clientId, projects }: { clientId: string; projects: ProjectRow[] }) {
  if (!projects.length) return null;
  const supabase = await createClient();
  const projectIds = projects.map((project) => project.id);
  const { data } = await supabase
    .from("project_actions")
    .select("id, project_id, title, description, status, due_at, response_note, phase_key, version_label, demo_url, preview_image_url, blocks_progress, demo_auth_type, created_at, updated_at")
    .in("project_id", projectIds)
    .eq("action_type", "approval")
    .order("created_at", { ascending: false });

  const approvals = (data ?? []) as ApprovalRow[];

  return (
    <section className="admin-panel approval-admin-panel" id="approvals" aria-labelledby="approval-admin-title">
      <div className="section-heading">
        <div><div className="eyebrow">Review & Freigabe</div><h2 id="approval-admin-title">Entwürfe kontrolliert freigeben lassen</h2></div>
        <span className="badge"><GitPullRequestDraft size={14} aria-hidden="true" />WERK Review</span>
      </div>
      <p className="admin-hint">Der Freigabe-Modus erscheint beim Kunden nur, wenn du einen Entwurf aktiv zur Entscheidung stellst. Blockierende Freigaben können den Wechsel in die nächste Projektphase sperren.</p>

      <div className="approval-admin-projects">
        {projects.map((project) => {
          const projectApprovals = approvals.filter((approval) => approval.project_id === project.id);
          return (
            <article className="approval-admin-project" key={project.id}>
              <div className="approval-admin-project-head">
                <div><div className="eyebrow">{project.name}</div><h3>{phaseLabels[project.phase] ?? project.phase}</h3></div>
                <span className="badge">{projectApprovals.length} Freigaben</span>
              </div>

              <ApprovalComposer clientId={clientId} projectId={project.id} projectName={project.name} currentPhase={project.phase} />

              <div className="approval-history-block">
                <div className="section-heading compact-heading"><div><div className="eyebrow">Historie</div><h3>Freigaben & Versionen</h3></div><History size={17} aria-hidden="true" /></div>
                {projectApprovals.length === 0 ? <div className="empty-state compact-empty">Noch keine Freigabe veröffentlicht.</div> : (
                  <div className="approval-history-list">
                    {projectApprovals.map((approval) => {
                      const approved = approval.status === "approved";
                      const changes = approval.status === "changes_requested";
                      return (
                        <div className={`approval-history-row status-${approval.status}`} key={approval.id}>
                          <div className="approval-history-icon">{approved ? <CheckCircle2 size={18} aria-hidden="true" /> : changes ? <GitPullRequestDraft size={18} aria-hidden="true" /> : <CircleDot size={18} aria-hidden="true" />}</div>
                          <div className="approval-history-main">
                            <div className="approval-history-title"><strong>{approval.title}</strong>{approval.version_label ? <span>{approval.version_label}</span> : null}</div>
                            <span>{phaseLabels[approval.phase_key ?? ""] ?? approval.phase_key ?? "Ohne Phase"} · {formatDate(approval.created_at)}</span>
                            {approval.response_note ? <p>Kundenfeedback: {approval.response_note}</p> : approval.description ? <p>{approval.description}</p> : null}
                          </div>
                          <div className="approval-history-actions">
                            <span className={`approval-status-pill is-${approval.status}`}>{statusLabels[approval.status] ?? approval.status}</span>
                            {approval.blocks_progress ? <span className="approval-block-tag">blockierend</span> : null}
                            {approval.demo_auth_type !== "none" ? <span className="approval-auth-tag"><LockKeyhole size={13} aria-hidden="true" />geschützt</span> : null}
                            {approval.demo_url ? <a className="secondary-button button-link" href={approval.demo_url} target="_blank" rel="noreferrer">Demo <ExternalLink size={14} aria-hidden="true" /></a> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
