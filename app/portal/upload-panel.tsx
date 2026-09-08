"use client";

import { FormEvent, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CheckCircle2, CloudUpload, FileText, LoaderCircle, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Project = { id: string; name: string };
type ProjectRequest = { id: string; projectId: string; title: string; status: "open" | "submitted" | "done" };
type ProjectAction = { id: string; projectId: string; title: string; type: "upload" | "approval" | "info"; status: string };
type Category = "document" | "image" | "video" | "other";
type UploadMode = "client" | "admin";
type FeedbackTone = "neutral" | "success" | "warning" | "error";

const MAX_FILE_SIZE = 100 * 1024 * 1024;

function safeFileName(name: string) {
  return name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "datei";
}

function inferCategory(file: File): Category {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (["pdf", "doc", "docx", "txt", "rtf", "odt", "xls", "xlsx", "csv", "ppt", "pptx"].includes(extension ?? "")) return "document";
  return "other";
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadPanel({
  projects,
  requests = [],
  actions = [],
  initialRequestId = "",
  initialActionId = "",
  mode,
}: {
  projects: Project[];
  requests?: ProjectRequest[];
  actions?: ProjectAction[];
  initialRequestId?: string;
  initialActionId?: string;
  mode?: UploadMode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const effectiveMode: UploadMode = mode ?? (pathname.startsWith("/admin") ? "admin" : "client");
  const supabase = useMemo(() => createClient(), []);
  const initialAction = effectiveMode === "client" ? actions.find((action) => action.id === initialActionId && action.type === "upload" && action.status !== "done") : undefined;
  const initialRequest = !initialAction && effectiveMode === "client" ? requests.find((request) => request.id === initialRequestId && request.status !== "done") : undefined;
  const [projectId, setProjectId] = useState(initialAction?.projectId ?? initialRequest?.projectId ?? projects[0]?.id ?? "");
  const [actionId, setActionId] = useState(initialAction?.id ?? "");
  const [requestId, setRequestId] = useState(initialRequest?.id ?? "");
  const [category, setCategory] = useState<Category>("document");
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const [tone, setTone] = useState<FeedbackTone>("neutral");
  const [uploading, setUploading] = useState(false);
  const projectActions = actions.filter((action) => action.projectId === projectId && action.type === "upload" && !["done", "approved"].includes(action.status));
  const projectRequests = requests.filter((request) => request.projectId === projectId && request.status !== "done");

  function setFeedback(text: string, nextTone: FeedbackTone = "neutral") {
    setStatus(text);
    setTone(nextTone);
  }

  function handleFiles(selectedFiles: File[]) {
    setFiles(selectedFiles);
    if (!selectedFiles.length) return;
    const categories = Array.from(new Set(selectedFiles.map(inferCategory)));
    setCategory(categories.length === 1 ? categories[0] : "other");
    setFeedback(`${selectedFiles.length} ${selectedFiles.length === 1 ? "Datei" : "Dateien"} bereit zum Upload.`);
  }

  function handleProjectChange(nextProjectId: string) {
    setProjectId(nextProjectId);
    if (!actions.some((action) => action.id === actionId && action.projectId === nextProjectId)) setActionId("");
    if (!requests.some((request) => request.id === requestId && request.projectId === nextProjectId)) setRequestId("");
  }

  function handleActionChange(nextActionId: string) {
    setActionId(nextActionId);
    setRequestId("");
    const selected = actions.find((action) => action.id === nextActionId);
    if (selected) setProjectId(selected.projectId);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!files.length || !projectId) return setFeedback("Bitte Projekt und mindestens eine Datei auswählen.", "error");
    const oversizedFile = files.find((file) => file.size > MAX_FILE_SIZE);
    if (oversizedFile) return setFeedback(`${oversizedFile.name} ist größer als 100 MB.`, "error");
    if (note.trim().length > 2000) return setFeedback("Die Notiz darf maximal 2.000 Zeichen lang sein.", "error");

    setUploading(true);
    setFeedback("Upload wird vorbereitet …");
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      setFeedback("Deine Sitzung ist abgelaufen. Bitte neu anmelden.", "error");
      setUploading(false);
      return;
    }

    const uploadId = crypto.randomUUID();
    const uploadedPaths: string[] = [];
    let persisted = false;

    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setFeedback(`Upload läuft … ${index + 1} von ${files.length}`);
        const storagePath = `${user.id}/${projectId}/${uploadId}-${crypto.randomUUID()}-${safeFileName(file.name)}`;
        const { error: uploadError } = await supabase.storage.from("project-files").upload(storagePath, file, { cacheControl: "3600", upsert: false, contentType: file.type || undefined });
        if (uploadError) throw uploadError;
        uploadedPaths.push(storagePath);

        const { error: metadataError } = await supabase.from("project_files").insert({
          project_id: projectId,
          uploader_id: user.id,
          upload_id: uploadId,
          action_id: effectiveMode === "client" && actionId ? actionId : null,
          request_id: effectiveMode === "client" && !actionId && requestId ? requestId : null,
          category,
          note: note.trim() || null,
          file_name: file.name,
          storage_path: storagePath,
          mime_type: file.type || null,
          size_bytes: file.size,
        });
        if (metadataError) throw metadataError;
      }

      if (effectiveMode === "client" && actionId) {
        const { data: updated, error: actionError } = await supabase.rpc("submit_project_action", { p_action_id: actionId });
        if (actionError || !updated) throw actionError ?? new Error("Die zugehörige Aufgabe konnte nicht aktualisiert werden.");
      }

      persisted = true;
      setFiles([]);
      setNote("");
      setActionId("");
      setRequestId("");
      form.reset();
      setProjectId(projects[0]?.id ?? "");
      setCategory("document");
      setFeedback("Upload gespeichert. Benachrichtigung wird versendet …");
      router.refresh();

      try {
        const notificationResponse = await fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "upload", projectId, eventId: uploadId }),
        });
        const notification = (await notificationResponse.json().catch(() => null)) as { configured?: boolean; failed?: unknown[] } | null;

        if (!notification?.configured) setFeedback("Upload gespeichert. Die E-Mail-Benachrichtigung ist derzeit nicht aktiviert.", "warning");
        else if (notification.failed?.length) setFeedback("Upload gespeichert. Mindestens eine E-Mail-Benachrichtigung konnte nicht zugestellt werden.", "warning");
        else if (effectiveMode === "admin") setFeedback("Upload gespeichert. Der Kunde wurde automatisch informiert.", "success");
        else setFeedback(actionId ? "Upload gespeichert. Die Aufgabe ist eingereicht und Hasim wurde informiert." : "Upload gespeichert. Hasim wurde automatisch informiert.", "success");
      } catch {
        setFeedback("Upload gespeichert. Die E-Mail-Benachrichtigung konnte gerade nicht versendet werden.", "warning");
      }
    } catch (error) {
      if (!persisted && uploadedPaths.length) {
        await supabase.storage.from("project-files").remove(uploadedPaths);
        await supabase.from("project_files").delete().eq("upload_id", uploadId);
      }
      setFeedback(`Upload fehlgeschlagen: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`, "error");
    } finally {
      setUploading(false);
    }
  }

  if (!projects.length) return <section className="upload-panel" id="upload"><h2>Dateien hochladen</h2><p className="muted">Es ist noch kein Projekt vorhanden.</p></section>;

  const FeedbackIcon = tone === "success" ? CheckCircle2 : tone === "warning" || tone === "error" ? TriangleAlert : uploading ? LoaderCircle : CloudUpload;

  return (
    <section className="upload-panel interaction-panel" id="upload" aria-labelledby="upload-title">
      <div className="section-heading compact-heading">
        <div><div className="eyebrow">Dateiaustausch</div><h2 id="upload-title">Dateien sicher übergeben</h2><p className="muted" id="upload-help">Mehrere Dateien gleichzeitig möglich. Maximal 100 MB pro Datei.</p></div>
        {files.length ? <span className="badge">{files.length} ausgewählt</span> : null}
      </div>

      <form className="upload-form upload-form-expanded" onSubmit={handleSubmit} aria-busy={uploading}>
        <div className="form-field-grid two-columns">
          <div className="form-field"><label htmlFor="upload-project">Projekt</label><select id="upload-project" value={projectId} onChange={(event) => handleProjectChange(event.target.value)} required disabled={uploading}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div>
          <div className="form-field"><label htmlFor="upload-category">Bereich</label><select id="upload-category" value={category} onChange={(event) => setCategory(event.target.value as Category)} disabled={uploading}><option value="image">Bilder & Grafiken</option><option value="document">Dokumente & PDF</option><option value="video">Videos</option><option value="other">Sonstiges</option></select></div>
        </div>

        {effectiveMode === "client" && projectActions.length ? <div className="form-field"><label htmlFor="upload-action">Zu welcher Aufgabe gehört der Upload?</label><select id="upload-action" value={actionId} onChange={(event) => handleActionChange(event.target.value)} disabled={uploading}><option value="">Allgemeiner Projekt-Upload</option>{projectActions.map((action) => <option key={action.id} value={action.id}>{action.status === "submitted" ? "Bereits eingereicht: " : "Benötigt: "}{action.title}</option>)}</select></div> : effectiveMode === "client" && projectRequests.length ? <div className="form-field"><label htmlFor="upload-request">Wofür sind die Dateien?</label><select id="upload-request" value={requestId} onChange={(event) => setRequestId(event.target.value)} disabled={uploading}><option value="">Allgemeiner Projekt-Upload</option>{projectRequests.map((request) => <option key={request.id} value={request.id}>{request.status === "submitted" ? "Bereits eingereicht: " : "Benötigt: "}{request.title}</option>)}</select></div> : null}

        <div className="dropzone-shell">
          <CloudUpload size={24} aria-hidden="true" />
          <div><strong>Dateien auswählen</strong><span>PDF, Office, Bilder, Videos und weitere Projektdateien</span></div>
          <input id="upload-files" type="file" multiple aria-describedby="upload-help" onChange={(event) => handleFiles(Array.from(event.target.files ?? []))} required disabled={uploading} />
        </div>

        {files.length ? <ul className="selected-files premium-selected-files" aria-label="Ausgewählte Dateien">{files.map((file) => <li key={`${file.name}-${file.size}`}><FileText size={15} aria-hidden="true" /><span>{file.name}</span><small>{formatBytes(file.size)}</small></li>)}</ul> : null}

        <div className="form-field"><label htmlFor="upload-note">Notiz zum Upload <span className="optional-label">optional</span></label><textarea id="upload-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={4} placeholder="Zum Beispiel: Bitte nur diese Logo-Version verwenden." disabled={uploading} /></div>

        <div className="upload-actions"><span className="muted note-counter" aria-hidden="true">{note.length}/2000</span><button className="primary-button" type="submit" disabled={uploading}>{uploading ? <><LoaderCircle className="spin" size={16} aria-hidden="true" />Wird hochgeladen …</> : files.length > 1 ? `${files.length} Dateien hochladen` : "Datei hochladen"}</button></div>
      </form>

      {status ? <div className={`inline-feedback feedback-${tone}`} role={tone === "error" ? "alert" : "status"} aria-live="polite"><FeedbackIcon className={uploading ? "spin" : undefined} size={17} aria-hidden="true" /><span>{status}</span></div> : null}
    </section>
  );
}
