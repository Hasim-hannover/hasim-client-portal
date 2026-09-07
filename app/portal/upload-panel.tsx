"use client";

import { FormEvent, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Project = { id: string; name: string };
type ProjectRequest = {
  id: string;
  projectId: string;
  title: string;
  status: "open" | "submitted" | "done";
};
type Category = "document" | "image" | "video" | "other";
type UploadMode = "client" | "admin";

const MAX_FILE_SIZE = 100 * 1024 * 1024;

function safeFileName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "datei";
}

function inferCategory(file: File): Category {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (["pdf", "doc", "docx", "txt", "rtf", "odt", "xls", "xlsx", "csv", "ppt", "pptx"].includes(extension ?? "")) return "document";
  return "other";
}

export function UploadPanel({
  projects,
  requests = [],
  initialRequestId = "",
  mode,
}: {
  projects: Project[];
  requests?: ProjectRequest[];
  initialRequestId?: string;
  mode?: UploadMode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const effectiveMode: UploadMode = mode ?? (pathname.startsWith("/admin") ? "admin" : "client");
  const supabase = useMemo(() => createClient(), []);
  const initialRequest = effectiveMode === "client"
    ? requests.find((request) => request.id === initialRequestId && request.status !== "done")
    : undefined;
  const [projectId, setProjectId] = useState(initialRequest?.projectId ?? projects[0]?.id ?? "");
  const [requestId, setRequestId] = useState(initialRequest?.id ?? "");
  const [category, setCategory] = useState<Category>("document");
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);

  const projectRequests = requests.filter((request) => request.projectId === projectId && request.status !== "done");

  function handleFiles(selectedFiles: File[]) {
    setFiles(selectedFiles);
    if (!selectedFiles.length) return;
    const categories = Array.from(new Set(selectedFiles.map(inferCategory)));
    setCategory(categories.length === 1 ? categories[0] : "other");
  }

  function handleProjectChange(nextProjectId: string) {
    setProjectId(nextProjectId);
    if (!requests.some((request) => request.id === requestId && request.projectId === nextProjectId)) setRequestId("");
  }

  function handleRequestChange(nextRequestId: string) {
    setRequestId(nextRequestId);
    const selected = requests.find((request) => request.id === nextRequestId);
    if (selected) setProjectId(selected.projectId);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!files.length || !projectId) {
      setStatus("Bitte Projekt und mindestens eine Datei auswählen.");
      return;
    }

    const oversizedFile = files.find((file) => file.size > MAX_FILE_SIZE);
    if (oversizedFile) {
      setStatus(`${oversizedFile.name} ist größer als 100 MB.`);
      return;
    }
    if (note.trim().length > 2000) {
      setStatus("Die Notiz darf maximal 2.000 Zeichen lang sein.");
      return;
    }

    setUploading(true);
    setStatus("Upload wird vorbereitet …");

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      setStatus("Deine Sitzung ist abgelaufen. Bitte neu anmelden.");
      setUploading(false);
      return;
    }

    const uploadId = crypto.randomUUID();
    const uploadedPaths: string[] = [];

    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setStatus(`Upload läuft … ${index + 1} von ${files.length}`);
        const storagePath = `${user.id}/${projectId}/${uploadId}-${crypto.randomUUID()}-${safeFileName(file.name)}`;
        const { error: uploadError } = await supabase.storage.from("project-files").upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || undefined,
        });
        if (uploadError) throw uploadError;
        uploadedPaths.push(storagePath);

        const { error: metadataError } = await supabase.from("project_files").insert({
          project_id: projectId,
          uploader_id: user.id,
          upload_id: uploadId,
          request_id: effectiveMode === "client" && requestId ? requestId : null,
          category,
          note: note.trim() || null,
          file_name: file.name,
          storage_path: storagePath,
          mime_type: file.type || null,
          size_bytes: file.size,
        });
        if (metadataError) throw metadataError;
      }

      const notificationResponse = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "upload", projectId, eventId: uploadId }),
      });
      const notification = (await notificationResponse.json().catch(() => null)) as { configured?: boolean; failed?: unknown[] } | null;

      if (!notification?.configured) {
        setStatus("Upload erfolgreich. Die E-Mail-Benachrichtigung ist noch nicht aktiviert.");
      } else if (notification.failed?.length) {
        setStatus("Upload erfolgreich. Mindestens eine E-Mail konnte nicht zugestellt werden.");
      } else if (effectiveMode === "admin") {
        setStatus("Upload erfolgreich. Der Kunde wurde automatisch per E-Mail benachrichtigt.");
      } else {
        setStatus("Upload erfolgreich. Hasim Üner wurde benachrichtigt und du hast eine Bestätigung per E-Mail erhalten.");
      }

      setFiles([]);
      setNote("");
      setRequestId("");
      event.currentTarget.reset();
      setProjectId(projects[0]?.id ?? "");
      setCategory("document");
      router.refresh();
    } catch (error) {
      if (uploadedPaths.length) {
        await Promise.all([
          supabase.storage.from("project-files").remove(uploadedPaths),
          supabase.from("project_files").delete().eq("upload_id", uploadId),
        ]);
      }
      const message = error instanceof Error ? error.message : "Unbekannter Fehler";
      setStatus(`Upload fehlgeschlagen: ${message}`);
    } finally {
      setUploading(false);
    }
  }

  if (projects.length === 0) {
    return <section className="upload-panel" id="upload"><h2>Dateien hochladen</h2><p className="muted">Es ist noch kein Projekt vorhanden.</p></section>;
  }

  return (
    <section className="upload-panel" id="upload" aria-labelledby="upload-title">
      <div className="section-heading compact-heading">
        <div><div className="eyebrow">Dateiaustausch</div><h2 id="upload-title">Dateien hochladen</h2><p className="muted" id="upload-help">Mehrere Dateien gleichzeitig möglich. Maximal 100 MB pro Datei.</p></div>
        {files.length ? <span className="badge">{files.length} ausgewählt</span> : null}
      </div>

      <form className="upload-form upload-form-expanded" onSubmit={handleSubmit} aria-busy={uploading}>
        <label htmlFor="upload-project">Projekt</label>
        <select id="upload-project" value={projectId} onChange={(event) => handleProjectChange(event.target.value)} required disabled={uploading}>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>

        {effectiveMode === "client" ? <>
          <label htmlFor="upload-request">Wofür sind die Dateien?</label>
          <select id="upload-request" value={requestId} onChange={(event) => handleRequestChange(event.target.value)} disabled={uploading}>
            <option value="">Allgemeiner Projekt-Upload</option>
            {projectRequests.map((request) => <option key={request.id} value={request.id}>{request.status === "submitted" ? "Bereits eingereicht: " : "Benötigt: "}{request.title}</option>)}
          </select>
        </> : null}

        <label htmlFor="upload-category">Bereich</label>
        <select id="upload-category" value={category} onChange={(event) => setCategory(event.target.value as Category)} disabled={uploading}>
          <option value="image">Bilder & Grafiken</option><option value="document">Dokumente & PDF</option><option value="video">Videos</option><option value="other">Sonstiges</option>
        </select>

        <label htmlFor="upload-files">Dateien</label>
        <input id="upload-files" type="file" multiple aria-describedby="upload-help" onChange={(event) => handleFiles(Array.from(event.target.files ?? []))} required disabled={uploading} />
        {files.length ? <ul className="selected-files" aria-label="Ausgewählte Dateien">{files.map((file) => <li key={`${file.name}-${file.size}`}>{file.name}</li>)}</ul> : null}

        <label htmlFor="upload-note">Notiz zum Upload <span className="optional-label">optional</span></label>
        <textarea id="upload-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={4} placeholder="Zum Beispiel: Bitte nur diese Logo-Version verwenden." disabled={uploading} />

        <div className="upload-actions">
          <span className="muted note-counter" aria-hidden="true">{note.length}/2000</span>
          <button className="primary-button" type="submit" disabled={uploading}>{uploading ? "Wird hochgeladen …" : files.length > 1 ? `${files.length} Dateien hochladen` : "Datei hochladen"}</button>
        </div>
      </form>
      {status ? <p className="upload-status" role="status" aria-live="polite">{status}</p> : null}
    </section>
  );
}
