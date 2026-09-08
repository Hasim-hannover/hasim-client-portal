import { CheckCircle2, Circle, Download, FileCheck2, ReceiptText, Rocket, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AdminDocumentUpload } from "./admin-document-upload";
import { markInvoicePayment, startProject, updateStartRequirement } from "./project-start-actions";

type ProjectRow = { id: string; name: string };
type RequirementRow = {
  id: string;
  project_id: string;
  requirement_key: string;
  title: string;
  description: string | null;
  is_required: boolean;
  client_can_submit: boolean;
  status: string;
  customer_note: string | null;
  admin_note: string | null;
  sort_order: number;
};
type DocumentRow = {
  id: string;
  project_id: string;
  file_name: string;
  storage_path: string;
  document_type: string | null;
  document_label: string | null;
  invoice_number: string | null;
  invoice_amount_net: number | null;
  invoice_due_at: string | null;
  invoice_payment_status: string | null;
  invoice_paid_at: string | null;
  note: string | null;
  created_at: string;
};

const statusLabels: Record<string, string> = {
  open: "Offen",
  submitted: "Vom Kunden gemeldet",
  verified: "Geprüft",
  not_needed: "Nicht erforderlich",
};

function formatMoney(value: number | null) {
  if (value == null) return null;
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(value));
}

export async function ProjectStartAdminPanel({ clientId, projects }: { clientId: string; projects: ProjectRow[] }) {
  if (!projects.length) return null;
  const supabase = await createClient();
  const projectIds = projects.map((project) => project.id);

  const [projectStateResult, requirementsResult, documentsResult] = await Promise.all([
    supabase.from("projects").select("id, started_at").in("id", projectIds),
    supabase.from("project_start_requirements").select("id, project_id, requirement_key, title, description, is_required, client_can_submit, status, customer_note, admin_note, sort_order").in("project_id", projectIds).order("sort_order", { ascending: true }),
    supabase.from("project_files").select("id, project_id, file_name, storage_path, document_type, document_label, invoice_number, invoice_amount_net, invoice_due_at, invoice_payment_status, invoice_paid_at, note, created_at").in("project_id", projectIds).not("document_type", "is", null).order("created_at", { ascending: false }),
  ]);

  const startedByProject = new Map((projectStateResult.data ?? []).map((row) => [row.id, row.started_at as string | null]));
  const requirements = (requirementsResult.data ?? []) as RequirementRow[];
  const documents = (documentsResult.data ?? []) as DocumentRow[];
  const signedByPath = new Map<string, string>();
  if (documents.length) {
    const { data } = await supabase.storage.from("project-files").createSignedUrls(documents.map((file) => file.storage_path), 60 * 10, { download: true });
    data?.forEach((item) => {
      if (item.path && item.signedUrl) signedByPath.set(item.path, item.signedUrl);
    });
  }

  return (
    <section className="admin-panel project-start-admin" id="project-start" aria-labelledby="project-start-admin-title">
      <div className="section-heading">
        <div><div className="eyebrow">Startfreigabe</div><h2 id="project-start-admin-title">Projektstart, Zugänge & kaufmännische Unterlagen</h2></div>
        <span className="badge">WERK Start</span>
      </div>
      <p className="admin-hint">Vor Phase 1 werden nur die echten Startbedingungen geprüft. Inhalte und Bildmaterial folgen später im Projekt.</p>

      <div className="project-start-admin-list">
        {projects.map((project) => {
          const projectRequirements = requirements.filter((item) => item.project_id === project.id);
          const projectDocuments = documents.filter((item) => item.project_id === project.id);
          const invoices = projectDocuments.filter((item) => item.document_type === "invoice");
          const contracts = projectDocuments.filter((item) => item.document_type === "contract");
          const required = projectRequirements.filter((item) => item.is_required);
          const completed = required.filter((item) => ["verified", "not_needed"].includes(item.status));
          const blockers = required.length - completed.length;
          const startedAt = startedByProject.get(project.id) ?? null;

          return (
            <article className="project-start-card" key={project.id}>
              <div className="project-start-card-head">
                <div>
                  <div className="eyebrow">{project.name}</div>
                  <h3>{startedAt ? "Projekt läuft" : "Projektstart vorbereiten"}</h3>
                  <p>{startedAt ? `Gestartet am ${formatDate(startedAt)}` : `${completed.length} von ${required.length} Pflichtpunkten erfüllt`}</p>
                </div>
                <span className={`start-gate-status ${startedAt ? "is-ready" : blockers === 0 ? "is-ready" : "is-pending"}`}>
                  {startedAt ? <Rocket size={16} aria-hidden="true" /> : blockers === 0 ? <CheckCircle2 size={16} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}
                  {startedAt ? "Gestartet" : blockers === 0 ? "Startbereit" : `${blockers} offen`}
                </span>
              </div>

              {!startedAt && required.length ? (
                <div className="start-progress" aria-label={`${completed.length} von ${required.length} Pflichtpunkten erfüllt`}><span style={{ width: `${Math.round((completed.length / required.length) * 100)}%` }} /></div>
              ) : null}

              {projectRequirements.length ? (
                <div className="start-requirement-admin-list">
                  {projectRequirements.map((item) => (
                    <form action={updateStartRequirement} className="start-requirement-admin-row" key={item.id}>
                      <input type="hidden" name="clientId" value={clientId} />
                      <input type="hidden" name="requirementId" value={item.id} />
                      <div className="start-requirement-copy">
                        <div className="start-requirement-title"><ShieldCheck size={16} aria-hidden="true" /><strong>{item.title}</strong>{item.is_required ? <span className="requirement-tag">Pflicht</span> : <span className="requirement-tag is-optional">Optional</span>}</div>
                        {item.description ? <p>{item.description}</p> : null}
                        {item.customer_note ? <small>Kundenhinweis: {item.customer_note}</small> : null}
                      </div>
                      <div className="start-requirement-controls">
                        <label className="inline-checkbox"><input type="checkbox" name="isRequired" defaultChecked={item.is_required} /> Pflicht</label>
                        <label className="sr-only" htmlFor={`requirement-status-${item.id}`}>Status für {item.title}</label>
                        <select id={`requirement-status-${item.id}`} name="status" defaultValue={item.status}>
                          <option value="open">Offen</option>
                          <option value="submitted">Vom Kunden gemeldet</option>
                          <option value="verified">Geprüft</option>
                          <option value="not_needed">Nicht erforderlich</option>
                        </select>
                        <input name="adminNote" defaultValue={item.admin_note ?? ""} maxLength={1200} placeholder="Interner Hinweis" aria-label={`Interner Hinweis zu ${item.title}`} />
                        <button className="secondary-button" type="submit">Speichern</button>
                      </div>
                      <span className={`requirement-status requirement-status-${item.status}`}>{statusLabels[item.status] ?? item.status}</span>
                    </form>
                  ))}
                </div>
              ) : <div className="empty-state compact-empty">Für dieses ältere Projekt gibt es keine Startfreigabe. Neue Projekte erhalten sie automatisch.</div>}

              {!startedAt && projectRequirements.length ? (
                <form action={startProject} className="project-start-submit">
                  <input type="hidden" name="clientId" value={clientId} />
                  <input type="hidden" name="projectId" value={project.id} />
                  <div><strong>{blockers === 0 ? "Alle Pflichtpunkte erfüllt." : "Projektstart noch blockiert."}</strong><span>{blockers === 0 ? "Phase 1 kann jetzt freigegeben werden." : "Pflichtpunkte müssen zuerst geprüft oder als nicht erforderlich markiert werden."}</span></div>
                  <button className="primary-button" type="submit" disabled={blockers > 0}><Rocket size={16} aria-hidden="true" />Projekt starten</button>
                </form>
              ) : null}

              <div className="project-document-grid">
                <div className="project-document-column">
                  <div className="section-heading compact-heading"><div><div className="eyebrow">Vertragsgrundlage</div><h3>Auftrag & Vertrag</h3></div><FileCheck2 size={18} aria-hidden="true" /></div>
                  {contracts.length ? contracts.map((file) => {
                    const signed = signedByPath.get(file.storage_path);
                    return <div className="document-record" key={file.id}><div><strong>{file.document_label || file.file_name}</strong><span>{formatDate(file.created_at)}</span>{file.note ? <p>{file.note}</p> : null}</div>{signed ? <a className="secondary-button button-link" href={signed}><Download size={15} aria-hidden="true" />PDF</a> : null}</div>;
                  }) : <div className="empty-state compact-empty">Noch kein Auftrag / Vertrag hinterlegt.</div>}
                </div>

                <div className="project-document-column">
                  <div className="section-heading compact-heading"><div><div className="eyebrow">Zahlungen</div><h3>Rechnungen</h3></div><ReceiptText size={18} aria-hidden="true" /></div>
                  {invoices.length ? invoices.map((file) => {
                    const signed = signedByPath.get(file.storage_path);
                    const isPaid = file.invoice_payment_status === "paid";
                    return (
                      <div className="document-record invoice-record" key={file.id}>
                        <div><strong>{file.document_label || file.file_name}</strong><span>{[file.invoice_number, formatMoney(file.invoice_amount_net), file.invoice_due_at ? `fällig ${formatDate(file.invoice_due_at)}` : null].filter(Boolean).join(" · ")}</span>{file.note ? <p>{file.note}</p> : null}</div>
                        <div className="document-record-actions">
                          <span className={`invoice-status ${isPaid ? "is-paid" : "is-open"}`}>{isPaid ? "Bezahlt" : "Offen"}</span>
                          {signed ? <a className="secondary-button button-link" href={signed}><Download size={15} aria-hidden="true" />PDF</a> : null}
                          <form action={markInvoicePayment}>
                            <input type="hidden" name="clientId" value={clientId} />
                            <input type="hidden" name="projectId" value={project.id} />
                            <input type="hidden" name="fileId" value={file.id} />
                            <input type="hidden" name="paymentStatus" value={isPaid ? "open" : "paid"} />
                            <button className="text-button" type="submit">{isPaid ? "Als offen" : "Zahlung bestätigen"}</button>
                          </form>
                        </div>
                      </div>
                    );
                  }) : <div className="empty-state compact-empty">Noch keine Rechnung hinterlegt.</div>}
                </div>
              </div>

              <AdminDocumentUpload projectId={project.id} projectName={project.name} />
            </article>
          );
        })}
      </div>
    </section>
  );
}
