"use client";

import { useMemo, useState } from "react";
import { ExternalLink, LockKeyhole, MonitorUp } from "lucide-react";
import { getPublicPreviewImageUrl } from "@/lib/approval-preview";
import { createApprovalAction } from "./approval-actions";

const phases = [
  ["onboarding", "Kick-off & Bestandsaufnahme"],
  ["content", "Design & Inhalte"],
  ["concept", "Konzept & Leitseiten"],
  ["development", "Entwicklung"],
  ["review", "Qualitätssicherung & Abnahme"],
  ["launch", "Livegang & Übergabe"],
  ["completed", "Abgeschlossen"],
] as const;

type AuthType = "none" | "shared_password" | "basic";

function validDemoUrl(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function ApprovalComposer({
  clientId,
  projectId,
  projectName,
  currentPhase,
}: {
  clientId: string;
  projectId: string;
  projectName: string;
  currentPhase: string;
}) {
  const [demoUrl, setDemoUrl] = useState("");
  const [authType, setAuthType] = useState<AuthType>("none");
  const normalized = useMemo(() => validDemoUrl(demoUrl), [demoUrl]);
  const previewImage = normalized && authType === "none" ? getPublicPreviewImageUrl(normalized) : null;

  return (
    <div className="approval-composer">
      <div className="section-heading compact-heading">
        <div><div className="eyebrow">Freigabe-Modus</div><h3>Entwurf zur Entscheidung stellen</h3></div>
        <span className="approval-mode-badge"><MonitorUp size={15} aria-hidden="true" />Review</span>
      </div>
      <p className="admin-hint">Nur aktiv, wenn du einen konkreten Entwurf zur Prüfung veröffentlichst. Der Kunde kann die Demo ansehen, freigeben oder mit Notiz Änderungen anfordern.</p>

      <form action={createApprovalAction} className="approval-composer-form">
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="projectId" value={projectId} />

        <div className="form-field-grid two-columns">
          <div className="form-field">
            <label htmlFor={`approval-title-${projectId}`}>Titel</label>
            <input id={`approval-title-${projectId}`} name="title" required maxLength={160} placeholder="Erster Entwurf · Header & Footer" />
          </div>
          <div className="form-field">
            <label htmlFor={`approval-version-${projectId}`}>Version</label>
            <input id={`approval-version-${projectId}`} name="versionLabel" maxLength={80} defaultValue="Entwurf 01" placeholder="Entwurf 01" />
          </div>
        </div>

        <div className="form-field">
          <label htmlFor={`approval-description-${projectId}`}>Prüfhinweis <span className="optional-label">optional</span></label>
          <textarea id={`approval-description-${projectId}`} name="description" rows={3} maxLength={2000} placeholder="Bitte prüfe Navigation, Aufbau und die grundsätzliche visuelle Richtung." />
        </div>

        <div className="form-field-grid two-columns">
          <div className="form-field">
            <label htmlFor={`approval-phase-${projectId}`}>Projektphase</label>
            <select id={`approval-phase-${projectId}`} name="phaseKey" defaultValue={currentPhase}>{phases.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          </div>
          <div className="form-field">
            <label htmlFor={`approval-due-${projectId}`}>Rückmeldung bis <span className="optional-label">optional</span></label>
            <input id={`approval-due-${projectId}`} name="dueAt" type="date" />
          </div>
        </div>

        <div className="form-field">
          <label htmlFor={`approval-url-${projectId}`}>Demo-URL</label>
          <input id={`approval-url-${projectId}`} name="demoUrl" type="url" required value={demoUrl} onChange={(event) => setDemoUrl(event.target.value)} placeholder="https://staging.kunde.de" />
        </div>

        <div className="form-field-grid two-columns">
          <div className="form-field">
            <label htmlFor={`approval-auth-${projectId}`}>Demo-Zugang</label>
            <select id={`approval-auth-${projectId}`} name="authType" value={authType} onChange={(event) => setAuthType(event.target.value as AuthType)}>
              <option value="none">Öffentlich / kein Passwort</option>
              <option value="shared_password">Gemeinsamer Zugangscode</option>
              <option value="basic">HTTP Basic Auth</option>
            </select>
          </div>
          <label className="approval-blocking-toggle">
            <input type="checkbox" name="blocksProgress" />
            <span><strong>Nächste Phase blockieren</strong><small>Erst nach Freigabe kann die Phase weitergestellt werden.</small></span>
          </label>
        </div>

        {authType !== "none" ? (
          <div className="approval-secret-fields">
            {authType === "basic" ? <div className="form-field"><label htmlFor={`approval-user-${projectId}`}>Benutzername</label><input id={`approval-user-${projectId}`} name="username" maxLength={160} autoComplete="off" required /></div> : null}
            <div className="form-field"><label htmlFor={`approval-secret-${projectId}`}>Zugangscode / Passwort</label><input id={`approval-secret-${projectId}`} name="secret" type="password" maxLength={1000} autoComplete="new-password" required /></div>
          </div>
        ) : null}

        <div className={`approval-preview-shell${previewImage ? " has-image" : " is-protected"}`}>
          {previewImage ? <div className="approval-preview-image" style={{ backgroundImage: `url(${JSON.stringify(previewImage)})` }} aria-label={`Automatische Vorschau für ${projectName}`} /> : (
            <div className="approval-preview-placeholder"><LockKeyhole size={26} aria-hidden="true" /><strong>{normalized ? new URL(normalized).host : "Demo-Vorschau"}</strong><span>{authType === "none" ? "Sobald eine gültige URL eingegeben ist, erscheint die Vorschau." : "Geschützte Demo: Zugangsdaten werden nicht an den Vorschaudienst übertragen."}</span></div>
          )}
          <div className="approval-preview-caption"><span>So erscheint der Entwurf im Kundenportal.</span>{normalized ? <a href={normalized} target="_blank" rel="noreferrer">URL testen <ExternalLink size={14} aria-hidden="true" /></a> : null}</div>
        </div>

        <button className="primary-button approval-publish-button" type="submit">Freigabe veröffentlichen</button>
      </form>
    </div>
  );
}
