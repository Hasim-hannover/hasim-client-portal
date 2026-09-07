import { redirect } from "next/navigation";
import {
  FileArchive,
  FileText,
  HelpCircle,
  Image,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  UploadCloud,
  Video,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./actions";
import { MessagePanel } from "./message-panel";
import { UploadPanel } from "./upload-panel";

const areas = [
  {
    key: "image",
    title: "Bilder & Grafiken",
    description: "Logos, Fotos, Screenshots und Produktbilder.",
    icon: Image,
  },
  {
    key: "document",
    title: "Dokumente & PDF",
    description: "Briefings, Texte, PDFs, Word- und Office-Dateien.",
    icon: FileText,
  },
  {
    key: "video",
    title: "Videos",
    description: "Rohmaterial, Aufnahmen und Referenzvideos.",
    icon: Video,
  },
  {
    key: "other",
    title: "Sonstiges",
    description: "Weitere Dateien, die zu deinem Projekt gehören.",
    icon: FileArchive,
  },
];

const categoryLabels: Record<string, string> = Object.fromEntries(
  areas.map((area) => [area.key, area.title]),
);

function formatBytes(bytes: number | null) {
  if (!bytes) return "–";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function PortalPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [projectsResult, filesResult, messagesResult] = await Promise.all([
    supabase.from("projects").select("id, name, status").order("created_at", { ascending: false }),
    supabase
      .from("project_files")
      .select("id, project_id, upload_id, category, note, file_name, storage_path, mime_type, size_bytes, created_at")
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("project_messages")
      .select("id, project_id, sender_id, body, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const projectList = projectsResult.data ?? [];
  const projectNames = new Map(projectList.map((project) => [project.id, project.name]));
  const loadError = projectsResult.error ?? filesResult.error ?? messagesResult.error;

  const fileList = await Promise.all(
    (filesResult.data ?? []).map(async (file) => {
      const { data } = await supabase.storage
        .from("project-files")
        .createSignedUrl(file.storage_path, 60 * 10);

      return {
        ...file,
        signedUrl: data?.signedUrl ?? null,
        projectName: projectNames.get(file.project_id) ?? "Projekt",
      };
    }),
  );

  const uploadGroups = Array.from(
    fileList.reduce((groups, file) => {
      const key = file.upload_id ?? file.id;
      const current = groups.get(key) ?? {
        id: key,
        projectName: file.projectName,
        category: file.category,
        note: file.note,
        createdAt: file.created_at,
        files: [] as typeof fileList,
      };
      current.files.push(file);
      groups.set(key, current);
      return groups;
    }, new Map<string, {
      id: string;
      projectName: string;
      category: string;
      note: string | null;
      createdAt: string;
      files: typeof fileList;
    }>()),
  ).map(([, group]) => group);

  const messages = (messagesResult.data ?? []).map((message) => ({
    ...message,
    projectName: projectNames.get(message.project_id) ?? "Projekt",
    senderLabel: message.sender_id === user.id ? "Du" : "Hasim Üner",
  }));

  const compactProjects = projectList.map(({ id, name }) => ({ id, name }));

  return (
    <div className="portal-shell">
      <aside className="sidebar">
        <div className="brand">Hasim Client Portal</div>
        <nav className="nav" aria-label="Portal Navigation">
          <a className="nav-item active" href="#dashboard">Dashboard</a>
          <a className="nav-item" href="#upload">Upload</a>
          <a className="nav-item" href="#dateien">Dateien</a>
          <a className="nav-item" href="#nachrichten">Nachrichten</a>
        </nav>

        <form action={logout} className="logout-form">
          <button type="submit" className="logout-button">
            <LogOut size={16} />
            Abmelden
          </button>
        </form>
      </aside>

      <main className="main" id="dashboard">
        <section className="portal-hero-grid">
          <div className="portal-hero-copy">
            <div className="eyebrow">Kundenportal</div>
            <h1>Alles für dein Projekt an einem Ort.</h1>
            <p className="lead">
              Lade Projektmaterial sicher hoch, ergänze Notizen und hinterlasse Nachrichten – alles bleibt deinem Projekt zugeordnet.
            </p>
            <p className="signed-in-as">Angemeldet als {user.email}</p>
          </div>

          <aside className="help-card" aria-label="So funktioniert das Kundenportal">
            <div className="help-card-title">
              <HelpCircle size={20} />
              <div>
                <div className="eyebrow">Kurz erklärt</div>
                <h2>So funktioniert der Dateiaustausch</h2>
              </div>
            </div>
            <p>
              Lade hier alle Dateien hoch, die ich für dein Projekt benötige – zum Beispiel Bilder, Logos, Dokumente oder Videos.
            </p>
            <div className="help-steps">
              <div><UploadCloud size={17} /><span>Eine oder mehrere Dateien auswählen und hochladen.</span></div>
              <div><MessageSquare size={17} /><span>Optional eine Notiz zum Upload hinterlassen.</span></div>
              <div><LayoutDashboard size={17} /><span>Nach dem Upload werde ich automatisch benachrichtigt; du erhältst eine Bestätigung.</span></div>
            </div>
          </aside>
        </section>

        {loadError ? (
          <div className="portal-warning">Ein Teil der Projektdaten konnte nicht geladen werden. Bitte Seite neu laden.</div>
        ) : null}

        <section className="card-grid category-grid" aria-label="Dateibereiche">
          {areas.map(({ key, title, description, icon: Icon }) => (
            <article className="card category-card" key={key}>
              <div className="card-icon" aria-hidden="true">
                <Icon size={21} strokeWidth={1.8} />
              </div>
              <h2>{title}</h2>
              <p>{description}</p>
            </article>
          ))}
        </section>

        <div id="upload">
          <UploadPanel projects={compactProjects} />
        </div>

        <section className="files-section" id="dateien">
          <div className="section-heading">
            <div>
              <div className="eyebrow">Projektdateien</div>
              <h2>Zuletzt hochgeladen</h2>
            </div>
            <span className="badge">{fileList.length} Dateien</span>
          </div>

          {uploadGroups.length === 0 ? (
            <div className="empty-state">Noch keine Dateien vorhanden.</div>
          ) : (
            <div className="upload-history">
              {uploadGroups.map((group) => (
                <article className="upload-history-group" key={group.id}>
                  <div className="upload-group-header">
                    <div>
                      <strong>{group.projectName}</strong>
                      <span>{categoryLabels[group.category] ?? "Sonstiges"} · {formatDate(group.createdAt)}</span>
                    </div>
                    <span className="badge">{group.files.length} {group.files.length === 1 ? "Datei" : "Dateien"}</span>
                  </div>

                  {group.note ? <p className="upload-note"><strong>Notiz:</strong> {group.note}</p> : null}

                  <div className="file-list">
                    {group.files.map((file) => (
                      <div className="file-row" key={file.id}>
                        <div>
                          <strong>{file.file_name}</strong>
                          <span>{formatBytes(file.size_bytes)}</span>
                        </div>
                        {file.signedUrl ? (
                          <a className="secondary-button" href={file.signedUrl} target="_blank" rel="noreferrer">
                            Öffnen
                          </a>
                        ) : (
                          <span className="muted">Nicht verfügbar</span>
                        )}
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <MessagePanel projects={compactProjects} />

        <section className="messages-history" aria-label="Letzte Projektnachrichten">
          <div className="section-heading">
            <div>
              <div className="eyebrow">Kommunikation</div>
              <h2>Letzte Nachrichten</h2>
            </div>
            <span className="badge">{messages.length}</span>
          </div>

          {messages.length === 0 ? (
            <div className="empty-state">Noch keine Projektnachrichten vorhanden.</div>
          ) : (
            <div className="message-list">
              {messages.map((message) => (
                <article className="message-item" key={message.id}>
                  <div className="message-meta">
                    <strong>{message.senderLabel}</strong>
                    <span>{message.projectName} · {formatDate(message.created_at)}</span>
                  </div>
                  <p>{message.body}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="status">
          <div>
            <strong>Privater Projektspeicher</strong>
            <span>Dateien liegen in einem privaten Supabase-Bucket und werden nur zeitlich begrenzt freigegeben.</span>
          </div>
          <div className="badge">
            <LayoutDashboard size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
            MVP
          </div>
        </section>
      </main>
    </div>
  );
}
