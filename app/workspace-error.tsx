"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";

export function WorkspaceError({ reset, title = "Bereich konnte nicht geladen werden" }: { reset: () => void; title?: string }) {
  return (
    <main className="state-shell">
      <section className="error-state-card" role="alert" aria-labelledby="workspace-error-title">
        <span className="error-state-icon"><TriangleAlert size={22} aria-hidden="true" /></span>
        <div>
          <div className="eyebrow">Temporärer Fehler</div>
          <h1 id="workspace-error-title">{title}</h1>
          <p>Die Daten konnten gerade nicht vollständig geladen werden. Bereits gespeicherte Inhalte bleiben unverändert.</p>
          <button className="primary-button" type="button" onClick={reset}><RotateCcw size={16} aria-hidden="true" />Erneut versuchen</button>
        </div>
      </section>
    </main>
  );
}
