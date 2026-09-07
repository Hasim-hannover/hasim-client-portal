"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Project = {
  id: string;
  name: string;
};

type Category = "document" | "image" | "video" | "other";

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
  if (["pdf", "doc", "docx", "txt", "rtf", "odt", "xls", "xlsx", "csv", "ppt", "pptx"].includes(extension ?? "")) {
    return "document";
  }

  return "other";
}

export function UploadPanel({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [category, setCategory] = useState<Category>("document");
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  function handleFiles(selectedFiles: File[]) {
    setFiles(selectedFiles);
    if (!selectedFiles.length) return;

    const categories = [...new Set(selectedFiles.map(inferCategory))];
    setCategory(categories.length === 1 ? categories[0] : "other");
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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

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

        const fileName = safeFileName(file.name);
        const storagePath = `${user.id}/${projectId}/${uploadId}-${crypto.randomUUID()}-${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("project-files")
          .upload(storagePath, file, {
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
      const notification = (await notificationResponse.json().catch(() => null)) as
        | { configured?: boolean; failed?: unknown[] }
        | null;

      if (!notification?.configured) {
        setStatus("Upload erfolgreich. Die E-Mail-Benachrichtigung ist noch nicht aktiviert.");
      } else if (notification.failed?.length) {
        setStatus("Upload erfolgreich. Mindestens eine E-Mail konnte nicht zugestellt werden.");
      } else {
        setStatus("Upload erfolgreich. Hasim Üner wurde benachrichtigt und du hast eine Bestätigung per E-Mail erhalten.");
      }

      setFiles([]);
      setNote("");
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
    return (
      <section className="upload-panel">
        <h2>Dateien hochladen</h2>
        <p className="muted">Dir ist noch kein Projekt zugeordnet. Erst danach sind Uploads möglich.</p>
      </section>
    );
  }

  return (
    <section className="upload-panel">
      <div className="section-heading compact-heading">
        <div>
          <div className="eyebrow">Dateiaustausch</div>
          <h2>Dateien hochladen</h2>
          <p className="muted">Mehrere Dateien gleichzeitig möglich. Maximal 100 MB pro Datei.</p>
        </div>
        {files.length ? <span className="badge">{files.length} ausgewählt</span> : null}
      </div>

      <form className="upload-form upload-form-expanded" onSubmit={handleSubmit}>
        <label>
          Projekt
          <select value={projectId} onChange={(event) => setProjectId(event.target.value)} required>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Bereich
          <select value={category} onChange={(event) => setCategory(event.target.value as Category)}>
            <option value="image">Bilder & Grafiken</option>
            <option value="document">Dokumente & PDF</option>
            <option value="video">Videos</option>
            <option value="other">Sonstiges</option>
          </select>
        </label>

        <label className="file-input-label upload-files-field">
          Dateien
          <input
            type="file"
            multiple
            onChange={(event) => handleFiles(Array.from(event.target.files ?? []))}
            required
          />
        </label>

        <label className="upload-note-field">
          Notiz zum Upload <span className="optional-label">optional</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="Zum Beispiel: Bitte nur diese Logo-Version verwenden."
          />
        </label>

        <div className="upload-actions">
          <span className="muted note-counter">{note.length}/2000</span>
          <button className="primary-button" type="submit" disabled={uploading}>
            {uploading ? "Wird hochgeladen …" : files.length > 1 ? `${files.length} Dateien hochladen` : "Datei hochladen"}
          </button>
        </div>
      </form>

      {status ? <p className="upload-status" role="status">{status}</p> : null}
    </section>
  );
}
