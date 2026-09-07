"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Project = {
  id: string;
  name: string;
};

type Category = "document" | "image" | "video";

const MAX_FILE_SIZE = 100 * 1024 * 1024;

function safeFileName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "datei";
}

export function UploadPanel({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [category, setCategory] = useState<Category>("document");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file || !projectId) {
      setStatus("Bitte Projekt und Datei auswählen.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setStatus("Die Datei ist größer als 100 MB.");
      return;
    }

    setUploading(true);
    setStatus("Upload läuft …");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setStatus("Deine Sitzung ist abgelaufen. Bitte neu anmelden.");
      setUploading(false);
      return;
    }

    const fileName = safeFileName(file.name);
    const storagePath = `${user.id}/${projectId}/${crypto.randomUUID()}-${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("project-files")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });

    if (uploadError) {
      setStatus(`Upload fehlgeschlagen: ${uploadError.message}`);
      setUploading(false);
      return;
    }

    const { error: metadataError } = await supabase.from("project_files").insert({
      project_id: projectId,
      uploader_id: user.id,
      category,
      file_name: file.name,
      storage_path: storagePath,
      mime_type: file.type || null,
      size_bytes: file.size,
    });

    if (metadataError) {
      await supabase.storage.from("project-files").remove([storagePath]);
      setStatus(`Datei konnte nicht gespeichert werden: ${metadataError.message}`);
      setUploading(false);
      return;
    }

    setFile(null);
    setStatus("Datei hochgeladen.");
    setUploading(false);
    event.currentTarget.reset();
    setProjectId(projects[0]?.id ?? "");
    setCategory("document");
    router.refresh();
  }

  if (projects.length === 0) {
    return (
      <section className="upload-panel">
        <h2>Datei hochladen</h2>
        <p className="muted">Dir ist noch kein Projekt zugeordnet. Erst danach sind Uploads möglich.</p>
      </section>
    );
  }

  return (
    <section className="upload-panel">
      <div>
        <div className="eyebrow">Dateiaustausch</div>
        <h2>Datei hochladen</h2>
        <p className="muted">Privater Speicher. Maximale Dateigröße: 100 MB.</p>
      </div>

      <form className="upload-form" onSubmit={handleSubmit}>
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
            <option value="document">Dokument</option>
            <option value="image">Bild</option>
            <option value="video">Video</option>
          </select>
        </label>

        <label className="file-input-label">
          Datei
          <input
            type="file"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            required
          />
        </label>

        <button className="primary-button" type="submit" disabled={uploading}>
          {uploading ? "Wird hochgeladen …" : "Hochladen"}
        </button>
      </form>

      {status ? <p className="upload-status" role="status">{status}</p> : null}
    </section>
  );
}
