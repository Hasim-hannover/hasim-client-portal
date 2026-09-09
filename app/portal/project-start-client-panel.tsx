import { CheckCircle2, Circle, Download, FileCheck2, ReceiptText, Send, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { submitStartRequirement } from "./actions";

type RequirementRow = {
  id: string;
  requirement_key: string;
  title: string;
  description: string | null;
  is_required: boolean;
  client_can_submit: boolean;
  status: string;
  customer_note: string | null;
  sort_order: number;
};
type DocumentRow = {
  id: string;
  file_name: string;
  storage_path: string;
  document_type: string | null;
  document_label: string | null;
  invoice_number: string | null;
  invoice_amount_net: number | null;
  invoice_due_at: string | null;
  invoice_payment_status: string | null;
  note: string | null;
  created_at: string;
};

const statusLabels: Record<string, string> = {
  open: "Offen",
  submitted: "Zur Prüfung gemeldet",
  verified: "Erledigt",
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

export async function ProjectStartClientPanel({ projectId, projectName, startedAt }: { projectId: string; projectName: string; startedAt: string | null }) {
  const supabase = await createClient();
  const [requirementsResult, documentsResult] = await Promise.all([
    supabase.from("project_start_requirements").select("id, requirement_key, title, description, is_required, client_can_submit, status, customer_note, sort_order").eq("project_id", projectId).order("sort_order", { ascending: true }),
    supabase.from("project_files").select("id, file_name, storage_path, document_type, document_label, invoice_number, invoice_amount_net, invoice_due_at, invoice_payment_status, note, created_at").eq("project_id", projectId).in("document_type", ["contract", "invoice"]).order("created_at", { ascending: false }),
  ]);

  const requirements = (requirementsResult.data ?? []) as RequirementRow[];
  const documents = (documentsResult.data ?? []) as DocumentRow[];
  const required = requirements.filter((item) => item.is_required);
  const completed = required.filter((item) => ["verified", "not_needed"].includes(item.status));
  const invoices = documents.filter((item) => item.document_type === "invoice");
  const contracts = documents.filter((item) => item.document_type === "contract");

  const signedByPath = new Map<string, string>();
  if (documents.length) {
    const { data } = await supabase.storage.from("project-files").createSignedUrls(documents.map((file) => file.storage_path), 60 * 10, { download: true });
    data?.forEach((item) => {
      if (item.path && item.signedUrl) signedByPath.set(item.path, item.signedUrl);
    });
  }

  if (!requirements.length && !documents.length) return null;

  return (
    <section className="client-start-section" id="projektstart" aria-labelledby="client-start-title">
      {!startedAt && requirements.length ? (
        <article className="client-start-gate">
          <div className="client-start-gate-head">
            <div>
              <div className="eyebrow">Projektstart</div>
              <h2 id="client-start-title">{projectName} wird startklar gemacht.</h2>
              <p>Diese Punkte brauchen wir vor Phase 1. Inhalte und Bildmaterial kommen später.</p>
            </div>
            <div className="start-progress-copy"><strong>{completed.length}/{required.length}</strong><span>Pflichtpunkte</span></div>
          </div>
          {required.length ? <div className="start-progress" aria-label={`${completed.length} von ${required.length} Pflichtpunkten erfüllt`}><span style={{ width: `${Math.round((completed.length / required.length) * 100)}%` }} /></div> : null}

          <div className="client-start-requirements">
            {requirements.map((item) => {
              const done = ["verified", "not_needed"].includes(item.status);
              const submitted = item.status === "submitted";
              return (
                <div className={`client-start-requirement${done ? " is-done" : submitted ? " is-submitted" : ""}`} key={item.id}>
                  <div className="client-start-requirement-icon">{done ? <CheckCircle2 size={18} aria-hidden="true" /> : <Circle size={18} aria-hidden="true" />}</div>
                  <div className="client-start-requirement-main">
                    <div className="start-requirement-title"><strong>{item.title}</strong>{item.is_required ? <span className="requirement-tag">Pflicht</span> : <span className="requirement-tag is-optional">Optional</span>}</div>
                    {item.description ? <p>{item.description}</p> : null}
                    <span className={`requirement-status requirement-status-${item.status}`}>{statusLabels[item.status] ?? item.status}</span>
                  </div>
                  {item.client_can_submit && !done ? (
                    <form action={submitStartRequirement} className="client-start-submit-form">
                      <input type="hidden" name="requirementId" value={item.id} />
                      <button className={submitted ? "secondary-button" : "primary-button"} type="submit" disabled={submitted}><Send size={15} aria-hidden="true" />{submitted ? "Gemeldet" : "Zugang bereitgestellt"}</button>
                    </form>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="start-gate-foot"><ShieldCheck size={17} aria-hidden="true" /><span>Sobald alle verpflichtenden Punkte geprüft sind, wird Phase 1 freigegeben.</span></div>
        </article>
      ) : null}

      {(contracts.length || invoices.length) ? (
        <article className="client-commercial-documents" aria-labelledby="commercial-documents-title">
          <div className="section-heading"><div><div className="eyebrow">Projektunterlagen</div><h2 id="commercial-documents-title">Auftrag & Rechnungen</h2></div><span className="badge">{contracts.length + invoices.length}</span></div>
          <div className="client-document-grid">
            <div className="client-document-column">
              <div className="client-document-heading"><FileCheck2 size={18} aria-hidden="true" /><strong>Auftrag & Vertrag</strong></div>
              {contracts.length ? contracts.map((file) => {
                const signed = signedByPath.get(file.storage_path);
                return <div className="client-document-record" key={file.id}><div><strong>{file.document_label || file.file_name}</strong><span>{formatDate(file.created_at)}</span>{file.note ? <p>{file.note}</p> : null}</div>{signed ? <a className="secondary-button button-link" href={signed}><Download size={15} aria-hidden="true" />PDF</a> : null}</div>;
              }) : <div className="empty-state compact-empty">Noch kein Vertragsdokument hinterlegt.</div>}
            </div>
            <div className="client-document-column">
              <div className="client-document-heading"><ReceiptText size={18} aria-hidden="true" /><strong>Rechnungen</strong></div>
              {invoices.length ? invoices.map((file) => {
                const signed = signedByPath.get(file.storage_path);
                const isPaid = file.invoice_payment_status === "paid";
                return <div className="client-document-record invoice-record" key={file.id}><div><strong>{file.document_label || file.file_name}</strong><span>{[file.invoice_number, formatMoney(file.invoice_amount_net), file.invoice_due_at ? `fällig ${formatDate(file.invoice_due_at)}` : null].filter(Boolean).join(" · ")}</span>{file.note ? <p>{file.note}</p> : null}</div><div className="document-record-actions"><span className={`invoice-status ${isPaid ? "is-paid" : "is-open"}`}>{isPaid ? "Bezahlt" : "Zahlung ausstehend"}</span>{signed ? <a className="secondary-button button-link" href={signed}><Download size={15} aria-hidden="true" />PDF</a> : null}</div></div>;
              }) : <div className="empty-state compact-empty">Noch keine Rechnung hinterlegt.</div>}
            </div>
          </div>
        </article>
      ) : null}
    </section>
  );
}
