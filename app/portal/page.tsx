import { redirect } from "next/navigation";
import { FileText, Image, LayoutDashboard, LogOut, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./actions";

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

export default async function PortalPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="portal-shell">
      <aside className="sidebar">
        <div className="brand">Hasim Client Portal</div>
        <nav className="nav" aria-label="Portal Navigation">
          <a className="nav-item active" href="#dashboard">Dashboard</a>
          <a className="nav-item" href="#dateien">Dateien</a>
          <a className="nav-item" href="#projekt">Projekt</a>
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
          Dateien austauschen, Projektmaterial verwalten und später Freigaben und Status direkt im Portal abwickeln.
        </p>
        <p className="signed-in-as">Angemeldet als {user.email}</p>

        <section className="card-grid" id="dateien" aria-label="Dateibereiche">
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

        <section className="status" id="projekt">
          <div>
            <strong>Portal-Grundsystem</strong>
            <span>Authentifizierung ist vorbereitet. Datei-Uploads werden im nächsten Schritt angeschlossen.</span>
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
