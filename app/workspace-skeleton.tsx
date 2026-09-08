export function WorkspaceSkeleton({ label = "Arbeitsbereich wird geladen" }: { label?: string }) {
  return (
    <main className="state-shell" aria-busy="true" aria-live="polite" aria-label={label}>
      <span className="sr-only">{label}</span>
      <div className="skeleton-topbar">
        <div>
          <div className="skeleton-line skeleton-eyebrow" />
          <div className="skeleton-line skeleton-title" />
          <div className="skeleton-line skeleton-lead" />
        </div>
        <div className="skeleton-line skeleton-action" />
      </div>
      <div className="skeleton-kpi-grid" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, index) => <div className="skeleton-card skeleton-kpi" key={index}><div className="skeleton-line skeleton-icon" /><div className="skeleton-line skeleton-number" /><div className="skeleton-line skeleton-label" /></div>)}
      </div>
      <div className="skeleton-content-grid" aria-hidden="true">
        <div className="skeleton-card skeleton-panel"><div className="skeleton-line skeleton-section-title" /><div className="skeleton-line skeleton-row" /><div className="skeleton-line skeleton-row" /><div className="skeleton-line skeleton-row short" /></div>
        <div className="skeleton-card skeleton-panel"><div className="skeleton-line skeleton-section-title" /><div className="skeleton-line skeleton-row" /><div className="skeleton-line skeleton-row short" /></div>
      </div>
    </main>
  );
}
