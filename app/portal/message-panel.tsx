"use client";

import { FormEvent, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Project = { id: string; name: string };

export function MessagePanel({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const supabase = useMemo(() => createClient(), []);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedMessage = message.trim();

    if (!projectId || !trimmedMessage) {
      setStatus("Bitte Projekt und Nachricht eingeben.");
      return;
    }
    if (trimmedMessage.length > 4000) {
      setStatus("Die Nachricht darf maximal 4.000 Zeichen lang sein.");
      return;
    }

    setSending(true);
    setStatus("Nachricht wird gespeichert …");

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setStatus("Deine Sitzung ist abgelaufen. Bitte neu anmelden.");
        return;
      }

      const { data: savedMessage, error } = await supabase
        .from("project_messages")
        .insert({ project_id: projectId, sender_id: user.id, body: trimmedMessage })
        .select("id")
        .single();
      if (error || !savedMessage) throw error ?? new Error("Nachricht konnte nicht gespeichert werden.");

      const notificationResponse = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "message", projectId, eventId: savedMessage.id }),
      });
      const notification = (await notificationResponse.json().catch(() => null)) as { configured?: boolean; failed?: unknown[] } | null;

      if (!notification?.configured) {
        setStatus("Nachricht gespeichert. Die E-Mail-Benachrichtigung ist noch nicht aktiviert.");
      } else if (notification.failed?.length) {
        setStatus("Nachricht gespeichert. Mindestens eine E-Mail konnte nicht zugestellt werden.");
      } else {
        setStatus(isAdmin ? "Nachricht gespeichert. Der Kunde wurde per E-Mail benachrichtigt." : "Nachricht gespeichert. Hasim Üner wurde benachrichtigt.");
      }

      setMessage("");
      router.refresh();
    } catch (error) {
      const text = error instanceof Error ? error.message : "Unbekannter Fehler";
      setStatus(`Nachricht fehlgeschlagen: ${text}`);
    } finally {
      setSending(false);
    }
  }

  if (!projects.length) return null;

  return (
    <section className="message-panel" id="nachrichten" aria-labelledby="message-title">
      <div><div className="eyebrow">Projektkommunikation</div><h2 id="message-title">{isAdmin ? "Nachricht an den Kunden" : "Nachricht hinterlassen"}</h2><p className="muted">{isAdmin ? "Die Nachricht bleibt im Projektverlauf und der Kunde erhält zusätzlich eine E-Mail." : "Für Hinweise, Rückfragen oder Informationen, die nicht direkt zu einem Upload gehören."}</p></div>

      <form className="message-form" onSubmit={handleSubmit} aria-busy={sending}>
        <label htmlFor="message-project">Projekt</label>
        <select id="message-project" value={projectId} onChange={(event) => setProjectId(event.target.value)} required disabled={sending}>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
        <label htmlFor="project-message">Nachricht</label>
        <textarea id="project-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={4000} rows={4} placeholder={isAdmin ? "Kurzes Update oder Rückfrage an den Kunden …" : "Was soll ich zu deinem Projekt wissen?"} required disabled={sending} />
        <div className="message-actions"><span className="muted note-counter" aria-hidden="true">{message.length}/4000</span><button className="primary-button" type="submit" disabled={sending}>{sending ? "Wird gesendet …" : "Nachricht senden"}</button></div>
      </form>

      {status ? <p className="upload-status" role="status" aria-live="polite">{status}</p> : null}
    </section>
  );
}
