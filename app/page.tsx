import { FileText, Image, LayoutDashboard, Video } from "lucide-react";

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

export default function HomePage() {
  return (
    <div className="portal-shell">
      <aside className="sidebar">
        <div className="brand">Hasim Client Portal</div>
        <nav className="nav" aria-label="Portal Navigation">
          <a className="nav-item active" href="#dashboard">Dashboard</a>
          <a className="nav-item" href="#dateien">Dateien</a>
          <a className="nav-item" href="#projekt">Projekt</a>
        </nav>
      </aside>

      <main className="main" id="dashboard">
        <div className="eyebrow">Kundenportal</div>
        <h1>Alles für dein Projekt an einem Ort.</h1>
        <p className="lead">
          Dateien austauschen, Projektmaterial verwalten und später Freigaben und Status direkt im Portal abwickeln.
        </p>

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
            <span>Login, Kundenzuordnung und Uploads werden als Nächstes angeschlossen.</span>
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
