import { ExternalLink, LockKeyhole } from "lucide-react";
import { getDemoHost } from "@/lib/approval-preview";
import { respondToApproval } from "./actions";
import { DemoAccess } from "./demo-access";

export type ApprovalCardAction = {
  id: string;
  title: string;
  description: string | null;
  response_note: string | null;
  due_at: string | null;
  phase_key: string | null;
  version_label: string | null;
  demo_url: string | null;
  preview_image_url: string | null;
  blocks_progress: boolean;
  demo_auth_type: string;
  projectName: string;
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

function formatDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(value));
}

export function ApprovalCard({ action }: { action: ApprovalCardAction }) {
  const previewStyle = action.preview_image_url ? { backgroundImage: `url(${JSON.stringify(action.preview_image_url)})` } : undefined;

  return (
    <article className="client-action-card action-approval approval-review-card" id={`action-${action.id}`}>
      <div className="approval-review-head">
        <div>
          <div className="action-type-row"><span className="action-type-pill">Freigabe erforderlich</span>{action.version_label ? <span className="approval-version-pill">{action.version_label}</span> : null}</div>
          <h3>{action.title}</h3>
          <p className="request-project">{action.projectName}{action.phase_key ? ` · ${phaseLabels[action.phase_key] ?? action.phase_key}` : ""}{action.due_at ? ` · Rückmeldung bis ${formatDate(action.due_at)}` : ""}</p>
        </div>
        {action.blocks_progress ? <span className="approval-block-tag">Meilenstein</span> : null}
      </div>

      {action.description ? <p className="approval-review-description">{action.description}</p> : null}

      {action.demo_url ? (
        <div className={`client-demo-preview${action.preview_image_url ? " has-image" : " is-protected"}`}>
          {action.preview_image_url ? <div className="client-demo-preview-image" style={previewStyle} aria-label={`Vorschau von ${action.title}`} /> : (
            <div className="client-demo-preview-placeholder"><LockKeyhole size={28} aria-hidden="true" /><strong>{getDemoHost(action.demo_url)}</strong><span>Geschützte Live-Demo</span></div>
          )}
          <div className="client-demo-preview-overlay">
            <span>Live-Entwurf</span>
            <a className="demo-primary-button" href={action.demo_url} target="_blank" rel="noreferrer">Demo ansehen <ExternalLink size={16} aria-hidden="true" /></a>
          </div>
        </div>
      ) : null}

      {action.demo_auth_type !== "none" ? <DemoAccess actionId={action.id} authType={action.demo_auth_type} /> : null}

      <div className="approval-decision-grid">
        <form action={respondToApproval} className="approval-change-form">
          <input type="hidden" name="actionId" value={action.id} />
          <input type="hidden" name="decision" value="changes_requested" />
          <label htmlFor={`approval-change-note-${action.id}`}>Änderungswunsch</label>
          <textarea id={`approval-change-note-${action.id}`} name="note" rows={3} maxLength={2000} required placeholder="Was soll angepasst werden? Bitte so konkret wie möglich." defaultValue={action.response_note ?? ""} />
          <button className="secondary-button approval-change-button" type="submit">Änderungen anfordern</button>
        </form>

        <form action={respondToApproval} className="approval-confirm-form">
          <input type="hidden" name="actionId" value={action.id} />
          <input type="hidden" name="decision" value="approved" />
          <div><strong>Passt der Entwurf?</strong><span>Mit der Freigabe bestätigst du diese Version als Grundlage für den nächsten Schritt.</span></div>
          <button className="primary-button approval-confirm-button" type="submit">Entwurf freigeben</button>
        </form>
      </div>
    </article>
  );
}
