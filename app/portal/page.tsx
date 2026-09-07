import { redirect } from "next/navigation";
import { FileText, Image, LayoutDashboard, LogOut, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./actions";
import { UploadPanel } from "./upload-panel";

const areas = [
  {
    title: "Dokumente",
    description: "Angebote, Briefings, Freigaben und andere Projektdateien zentral ablegen.",
    icon: FileText,
  },
  {
    title: "Bilder",
    description: "Logos, Screenshots, Produktbilder und andere Bilddateien mit Kunden austauschen.",
    icon: Image,
  },
  {
    title: "Videos",
    description: "Video-Dateien und Aufnahmen projektbezogen bereitstellen und verwalten.",
    icon: Video,
  },
];

function formatBytes(bytes: number | null) {
  if (!bytes) return "–";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function PortalPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: projects }, { data: files }] = await Promise.all([
    supabase.from("projects").select("id, name, status").order("created_at", { ascending: false }),
    supabase
      .from("project_files")
      .select("id, project_id, category, file_name, storage_path, mime_type, size_bytes, created_at")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const projectList = projects ?? [];
  const projectNames = new Map(projectList.map((project) => [project.id, project.name]));

  const fileList = await Promise.all(
    (files ?? []).map(async (file) => {
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

  return (
    <div className="portal-shell">
      <aside className="sidebar">
        <div className="brand">Hasim Client Portal</div>
        <nav className="nav" aria-label="Portal Navigation">
          <a className="nav-item active" href="#dashboard">Dashboard</a>
          <a className="nav-item" href="#dateien">Dateien</a>
          <a className="nav-item" href="#upload">Upload</a>
        </nav>

        <form action={logout} className="logout-form">
          <button type="submit" className="logout-button">
            <LogOut size={16} />
            Abmelden
          </button>
        </form>
      </aside>

      <main className="main" id="dashboard">
        <div className="eyebrow">Kundenportal</div>
        <h1>Alles für dein Projekt an einem Ort.</h1>
        <p className="lead">
          Dateien austauschen und Projektmaterial geschützt an einem zentralen Ort verwalten.
        </p>
        <p className="signed-in-as">Angemeldet als {user.email}</p>

        <section className="card-grid" aria-label="Dateibereiche">
          {areas.map(({ title, description, icon: Icon }) => (
            <article className="card" key={title}>
              <div className="card-icon" aria-hidden="true">
                <Icon size={21} strokeWidth={1.8} />
              </div>
              <h2>{title}</h2>
              <p>{description}</p>
            </article>
          ))}
        </section>

        <div id="upload">
          <UploadPanel projects={projectList.map(({ id, name }) => ({ id, name }))} />
        </div>

        <section className="files-section" id="dateien">
          <div className="section-heading">
            <div>
              <div className="eyebrow">Projektdateien</div>
              <h2>Zuletzt hochgeladen</h2>
            </div>
            <span className="badge">{fileList.length} Dateien</span>
          </div>

          {fileList.length === 0 ? (
            <div className="empty-state">Noch keine Dateien vorhanden.</div>
          ) : (
            <div className="file-list">
              {fileList.map((file) => (
                <div className="file-row" key={file.id}>
                  <div>
                    <strong>{file.file_name}</strong>
                    <span>{file.projectName} · {file.category} · {formatBytes(file.size_bytes)}</span>
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
