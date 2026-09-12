"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createClientWorkspace } from "./actions";
import styles from "./onboarding.module.css";
import uploadStyles from "./onboarding-upload.module.css";

const phases = [
  ["onboarding", "Onboarding"],
  ["content", "Inhalte & Material"],
  ["concept", "Konzept"],
  ["development", "Umsetzung"],
  ["review", "Prüfung & Freigabe"],
  ["launch", "Launch"],
] as const;

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const PDF_SIGNATURE = "%PDF-";

function safeFileName(name: string) {
  return name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "dokument.pdf";
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function isPdfFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".pdf")) return false;
  if (file.type && file.type !== "application/pdf") return false;
  const header = new Uint8Array(await file.slice(0, PDF_SIGNATURE.length).arrayBuffer());
  if (header.length < PDF_SIGNATURE.length) return false;
  return String.fromCharCode(header[0], header[1], header[2], header[3], header[4]) === PDF_SIGNATURE;
}

export function OnboardingPdfForm({ message, error }: { message?: string; error?: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [documentLabel, setDocumentLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = selectedFile ?? fileRef.current?.files?.[0] ?? null;

    if (file) {
      if (file.size > MAX_FILE_SIZE) return setFeedback("Die PDF ist größer als 100 MB.");
      if (!(await isPdfFile(file))) return setFeedback("Bitte eine gültige PDF-Datei auswählen.");
    }

    setSubmitting(true);
    setFeedback(file ? "Projektraum wird angelegt und PDF vorbereitet …" : "Projektraum wird angelegt …");

    try {
      const workspaceData = new FormData(form);
      workspaceData.delete("documentFile");
      workspaceData.delete("documentLabel");
      const workspace = await createClientWorkspace(workspaceData);

      if (file) {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) throw new Error("Admin-Sitzung ist abgelaufen.");

        const uploadId = crypto.randomUUID();
        const storagePath = `${user.id}/${workspace.projectId}/${uploadId}-${crypto.randomUUID()}-${safeFileName(file.name)}`;
        const { error: storageError } = await supabase.storage.from("project-files").upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: "application/pdf",
        });
        if (storageError) throw storageError;

        const { error: metadataError } = await supabase.from("project_files").insert({
          project_id: workspace.projectId,
          uploader_id: user.id,
          upload_id: uploadId,
          category: "document",
          note: "Beim Onboarding hinterlegt.",
          file_name: file.name,
          storage_path: storagePath,
          mime_type: "application/pdf",
          size_bytes: file.size,
          document_type: "contract",
          document_label: documentLabel.trim() || "Angebot / Auftrag / Vertrag",
        });
        if (metadataError) {
          await supabase.storage.from("project-files").remove([storagePath]);
          throw metadataError;
        }
      }

      const text = file
        ? "Projektraum vorbereitet und PDF hinterlegt. Du kannst weitere Inhalte ergänzen und danach die Einladung senden."
        : "Projektraum vorbereitet. Du kannst jetzt Inhalte, Dateien und Freigaben hinterlegen und danach die Einladung senden.";
      router.push(`/admin/clients/${workspace.clientId}?message=${encodeURIComponent(text)}`);
      router.refresh();
    } catch (caught) {
      setFeedback(caught instanceof Error ? caught.message : "Projektraum konnte nicht vorbereitet werden.");
      setSubmitting(false);
    }
  }

  return (
    <>
      {message ? <div className={styles.notice} role="status">{message}</div> : null}
      {error ? <div className={styles.error} role="alert">{error}</div> : null}
      <form className={styles.form} onSubmit={handleSubmit} aria-busy={submitting}>
        <div className={styles.group}>
          <div className={styles.field}><label htmlFor="workspace-name">Ansprechpartner</label><input id="workspace-name" name="fullName" required maxLength={160} autoComplete="name" placeholder="Max Mustermann" disabled={submitting} /></div>
          <div className={styles.field}><label htmlFor="workspace-company">Unternehmen <span className={styles.optional}>optional</span></label><input id="workspace-company" name="companyName" maxLength={160} autoComplete="organization" placeholder="Muster GmbH" disabled={submitting} /></div>
        </div>
        <div className={styles.field}><label htmlFor="workspace-email">E-Mail</label><input id="workspace-email" name="email" type="email" required autoComplete="email" placeholder="kunde@example.de" disabled={submitting} /></div>
        <div className={styles.field}><label htmlFor="workspace-project">Projekt</label><input id="workspace-project" name="projectName" required maxLength={160} placeholder="Website Relaunch 2026" disabled={submitting} /></div>
        <div className={styles.field}><label htmlFor="workspace-phase">Startphase</label><select id="workspace-phase" name="phase" defaultValue="onboarding" required disabled={submitting}>{phases.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div className={styles.field}><label htmlFor="workspace-phase-note">Aktueller Projektstand <span className={styles.optional}>optional</span></label><textarea id="workspace-phase-note" name="phaseNote" rows={4} maxLength={1200} placeholder="Zum Beispiel: Konzept steht, als Nächstes wird die Startseite zur Prüfung vorbereitet." disabled={submitting} /></div>

        <div className={uploadStyles.documentBlock}>
          <div className={uploadStyles.documentHead}><div><span>Projektunterlage</span><h3>PDF direkt hinterlegen</h3></div><FileText aria-hidden="true" /></div>
          <div className={styles.field}>
            <label htmlFor="workspace-document">Angebot / Auftrag / Vertrag <span className={styles.optional}>optional</span></label>
            <input ref={fileRef} id="workspace-document" name="documentFile" type="file" accept="application/pdf,.pdf" disabled={submitting} onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setSelectedFile(file);
              if (file && !documentLabel) setDocumentLabel(file.name.replace(/\.pdf$/i, ""));
              setFeedback("");
            }} />
          </div>
          {selectedFile ? <div className={styles.field}><label htmlFor="workspace-document-label">Anzeigename</label><input id="workspace-document-label" name="documentLabel" value={documentLabel} onChange={(event) => setDocumentLabel(event.target.value)} maxLength={160} placeholder="Angebot & Projektgrundlage" disabled={submitting} /></div> : null}
          {selectedFile && previewUrl ? (
            <div className={uploadStyles.pdfPreview}>
              <div className={uploadStyles.pdfPreviewHead}><div><strong>{selectedFile.name}</strong><span>{formatBytes(selectedFile.size)} · PDF</span></div><span>Vorschau vor dem Anlegen</span></div>
              <iframe src={previewUrl} title={`PDF-Vorschau: ${selectedFile.name}`} />
            </div>
          ) : <p className={uploadStyles.documentHint}>PDF auswählen und direkt hier prüfen. Nach dem Anlegen liegt sie privat im Projekt und erscheint später für den Kunden mit Vorschau.</p>}
        </div>

        {feedback ? <div className={uploadStyles.inlineFeedback} role="status">{feedback}</div> : null}
        <div className={styles.submitRow}>
          <p>Nach dem Anlegen gelangst du direkt in die Kundenakte. Die Einladung verschickst du dort bewusst separat.</p>
          <button className={styles.submit} type="submit" disabled={submitting}>{submitting ? <><LoaderCircle className={uploadStyles.spin} size={16} aria-hidden="true" /> Wird vorbereitet …</> : "Projektraum anlegen"}</button>
        </div>
      </form>
    </>
  );
}
