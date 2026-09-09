"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileUp, LoaderCircle, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type DocumentType = "contract" | "invoice" | "project" | "approval" | "handover";
type Tone = "neutral" | "success" | "error";

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const PDF_SIGNATURE = "%PDF-";

function safeFileName(name: string) {
  return name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "dokument.pdf";
}

async function isPdfFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".pdf")) return false;
  if (file.type && file.type !== "application/pdf") return false;

  const header = new Uint8Array(await file.slice(0, PDF_SIGNATURE.length).arrayBuffer());
  if (header.length < PDF_SIGNATURE.length) return false;
  const signature = String.fromCharCode(header[0], header[1], header[2], header[3], header[4]);
  return signature === PDF_SIGNATURE;
}

export function AdminDocumentUpload({ projectId, projectName }: { projectId: string; projectName: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [documentType, setDocumentType] = useState<DocumentType>("contract");
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceDueAt, setInvoiceDueAt] = useState("");
  const [status, setStatus] = useState("");
  const [tone, setTone] = useState<Tone>("neutral");
  const [uploading, setUploading] = useState(false);

  function feedback(message: string, nextTone: Tone = "neutral") {
    setStatus(message);
    setTone(nextTone);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return feedback("Bitte eine PDF-Datei auswählen.", "error");
    if (file.size > MAX_FILE_SIZE) return feedback("Die Datei ist größer als 100 MB.", "error");
    if (!(await isPdfFile(file))) return feedback("Bitte eine gültige PDF-Datei hochladen.", "error");
    if (label.trim().length > 160 || note.trim().length > 2000) return feedback("Titel oder Nachricht ist zu lang.", "error");

    const parsedAmount = invoiceAmount.trim() ? Number(invoiceAmount.replace(",", ".")) : null;
    if (documentType === "invoice" && parsedAmount !== null && (!Number.isFinite(parsedAmount) || parsedAmount < 0)) return feedback("Bitte einen gültigen Nettobetrag angeben.", "error");

    setUploading(true);
    feedback("Dokument wird hochgeladen …");

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      setUploading(false);
      return feedback("Sitzung abgelaufen. Bitte neu anmelden.", "error");
    }

    const uploadId = crypto.randomUUID();
    const storagePath = `${user.id}/${projectId}/${uploadId}-${crypto.randomUUID()}-${safeFileName(file.name)}`;

    try {
      const { error: storageError } = await supabase.storage.from("project-files").upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: "application/pdf",
      });
      if (storageError) throw storageError;

      const { error: metadataError } = await supabase.from("project_files").insert({
        project_id: projectId,
        uploader_id: user.id,
        upload_id: uploadId,
        category: "document",
        note: note.trim() || null,
        file_name: file.name,
        storage_path: storagePath,
        mime_type: "application/pdf",
        size_bytes: file.size,
        document_type: documentType,
        document_label: label.trim() || null,
        invoice_number: documentType === "invoice" ? invoiceNumber.trim() || null : null,
        invoice_amount_net: documentType === "invoice" ? parsedAmount : null,
        invoice_due_at: documentType === "invoice" ? invoiceDueAt || null : null,
        invoice_payment_status: documentType === "invoice" ? "open" : null,
      });
      if (metadataError) {
        await supabase.storage.from("project-files").remove([storagePath]);
        throw metadataError;
      }

      try {
        await fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "upload", projectId, eventId: uploadId }),
        });
      } catch {
        // The document itself is authoritative; notification delivery is best effort.
      }

      event.currentTarget.reset();
      setLabel("");
      setNote("");
      setInvoiceNumber("");
      setInvoiceAmount("");
      setInvoiceDueAt("");
      feedback(`${documentType === "invoice" ? "Rechnung" : documentType === "contract" ? "Auftrag / Vertrag" : "Dokument"} ist im Kundenportal verfügbar.`, "success");
      router.refresh();
    } catch (error) {
      feedback(`Upload fehlgeschlagen: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`, "error");
    } finally {
      setUploading(false);
    }
  }

  const StatusIcon = uploading ? LoaderCircle : tone === "success" ? CheckCircle2 : tone === "error" ? TriangleAlert : FileUp;

  return (
    <div className="admin-document-upload">
      <div className="section-heading compact-heading">
        <div><div className="eyebrow">Dokument bereitstellen</div><h3>Vertrag, Rechnung oder Projektunterlage</h3></div>
      </div>
      <form className="admin-form" onSubmit={handleSubmit} aria-busy={uploading}>
        <div className="form-field-grid two-columns">
          <div className="form-field">
            <label htmlFor={`document-type-${projectId}`}>Dokumenttyp</label>
            <select id={`document-type-${projectId}`} value={documentType} onChange={(event) => setDocumentType(event.target.value as DocumentType)} disabled={uploading}>
              <option value="contract">Auftrag / Vertrag</option>
              <option value="invoice">Rechnung</option>
              <option value="project">Projektunterlage</option>
              <option value="approval">Freigabe / Abnahme</option>
              <option value="handover">Übergabe</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor={`document-label-${projectId}`}>Anzeigename <span className="optional-label">optional</span></label>
            <input id={`document-label-${projectId}`} value={label} onChange={(event) => setLabel(event.target.value)} maxLength={160} placeholder={documentType === "invoice" ? "1. Teilrechnung – 30 %" : "Auftrag & Vertragsgrundlage"} disabled={uploading} />
          </div>
        </div>

        {documentType === "invoice" ? (
          <div className="invoice-meta-grid">
            <div className="form-field"><label htmlFor={`invoice-number-${projectId}`}>Rechnungsnummer</label><input id={`invoice-number-${projectId}`} value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} maxLength={80} placeholder="RE-2026-001" disabled={uploading} /></div>
            <div className="form-field"><label htmlFor={`invoice-amount-${projectId}`}>Netto-Betrag</label><input id={`invoice-amount-${projectId}`} value={invoiceAmount} onChange={(event) => setInvoiceAmount(event.target.value)} inputMode="decimal" placeholder="2670,00" disabled={uploading} /></div>
            <div className="form-field"><label htmlFor={`invoice-due-${projectId}`}>Fällig am</label><input id={`invoice-due-${projectId}`} value={invoiceDueAt} onChange={(event) => setInvoiceDueAt(event.target.value)} type="date" disabled={uploading} /></div>
          </div>
        ) : null}

        <div className="form-field"><label htmlFor={`document-file-${projectId}`}>PDF-Datei</label><input ref={fileRef} id={`document-file-${projectId}`} type="file" accept="application/pdf,.pdf" required disabled={uploading} /></div>
        <div className="form-field"><label htmlFor={`document-note-${projectId}`}>Kurze Nachricht an den Kunden <span className="optional-label">optional</span></label><textarea id={`document-note-${projectId}`} value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={2000} placeholder={`Kurzer Hinweis zu ${projectName}.`} disabled={uploading} /></div>
        <button className="primary-button" type="submit" disabled={uploading}>{uploading ? "Wird hochgeladen …" : "Dokument veröffentlichen"}</button>
      </form>
      {status ? <div className={`document-upload-feedback is-${tone}`} role={tone === "error" ? "alert" : "status"}><StatusIcon size={17} aria-hidden="true" /><span>{status}</span></div> : null}
    </div>
  );
}
