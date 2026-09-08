"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, LoaderCircle } from "lucide-react";

type SecretResponse = { username: string | null; secret: string };

export function DemoAccess({ actionId, authType }: { actionId: string; authType: string }) {
  const [data, setData] = useState<SecretResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  async function reveal() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/approvals/${encodeURIComponent(actionId)}/secret`, { cache: "no-store" });
      const payload = await response.json().catch(() => null) as (SecretResponse & { error?: string }) | null;
      if (!response.ok || !payload?.secret) throw new Error(payload?.error || "Zugangsdaten konnten nicht geladen werden.");
      setData({ username: payload.username ?? null, secret: payload.secret });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Zugangsdaten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  async function copy(value: string, field: string) {
    await navigator.clipboard.writeText(value);
    setCopied(field);
    window.setTimeout(() => setCopied(""), 1800);
  }

  if (!data) {
    return (
      <div className="demo-access-box">
        <div><KeyRound size={17} aria-hidden="true" /><span><strong>Passwortgeschützte Demo</strong><small>{authType === "basic" ? "Benutzername und Passwort sind geschützt hinterlegt." : "Der Zugangscode ist geschützt hinterlegt."}</small></span></div>
        <button className="secondary-button" type="button" onClick={reveal} disabled={loading}>{loading ? <><LoaderCircle size={15} className="spin" aria-hidden="true" />Laden …</> : "Zugangsdaten anzeigen"}</button>
        {error ? <p className="demo-access-error" role="alert">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="demo-access-box is-revealed">
      {data.username ? (
        <div className="demo-credential-row"><span><small>Benutzername</small><strong>{data.username}</strong></span><button className="text-button" type="button" onClick={() => copy(data.username!, "username")}>{copied === "username" ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}{copied === "username" ? "Kopiert" : "Kopieren"}</button></div>
      ) : null}
      <div className="demo-credential-row"><span><small>{authType === "basic" ? "Passwort" : "Zugangscode"}</small><strong>{data.secret}</strong></span><button className="text-button" type="button" onClick={() => copy(data.secret, "secret")}>{copied === "secret" ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}{copied === "secret" ? "Kopiert" : "Kopieren"}</button></div>
    </div>
  );
}
