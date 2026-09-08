"use client";

import { FormEvent, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle, MessageSquareText, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Project = { id: string; name: string };
type FeedbackTone = "neutral" | "success" | "warning" | "error";

export function MessagePanel({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const supabase = useMemo(() => createClient(), []);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [tone, setTone] = useState<FeedbackTone>("neutral");
  const [sending, setSending] = useState(false);

  function setFeedback(text: string, nextTone: FeedbackTone = "neutral") {
    setStatus(text);
    setTone(nextTone);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedMessage = message.trim();

    if (!projectId || !trimmedMessage) {
      setFeedback("Bitte Projekt und Nachricht eingeben.", "error");
      return;
    }
    if (trimmedMessage.length > 4000) {
      setFeedback("Die Nachricht darf maximal 4.000 Zeichen lang sein.", "error");
      return;
    }

    setSending(true);
    setFeedback("Nachricht wird gespeichert …");

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setFeedback("Deine Sitzung ist abgelaufen. Bitte neu anmelden.", "error");
        return;
      }

      const { data: savedMessage, error } = await supabase
        .from("project_messages")
        .insert({ project_id: projectId, sender_id: user.id, body: trimmedMessage })
        .select("id")
        .single();
      if (error || !savedMessage) throw error ?? new Error("Nachricht konnte nicht gespeichert werden.");

      setMessage("");
      setFeedback("Nachricht gespeichert. Benachrichtigung wird versendet …");
      router.refresh();

      try {
        const notificationResponse = await fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "message", projectId, eventId: savedMessage.id }),
        });
        const notification = (await notificationResponse.json().catch(() => null)) as { configured?: boolean; failed?: unknown[] } | null;

        if (!notification?.configured) {
          setFeedback("Nachricht gespeichert. Die E-Mail-Benachrichtigung ist derzeit nicht aktiviert.", "warning");
        } else if (notification.failed?.length) {
          setFeedback("Nachricht gespeichert. Mindestens eine E-Mail konnte nicht zugestellt werden.", "warning");
        } else {
          setFeedback(isAdmin ? "Nachricht gespeichert. Der Kunde wurde automatisch informiert." : "Nachricht gespeichert. Hasim wurde automatisch informiert.", "success");
        }
      } catch {
        setFeedback("Nachricht gespeichert. Die E-Mail-Benachrichtigung konnte gerade nicht versendet werden.", "warning");
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : "Unbekannter Fehler";
      setFeedback(`Nachricht konnte nicht gespeichert werden: ${text}`, "error");
    } finally {
      setSending(false);
    }
  }

  if (!projects.length) return null;
  const FeedbackIcon = tone === "success" ? CheckCircle2 : tone === "warning" || tone === "error" ? TriangleAlert : sending ? LoaderCircle : MessageSquareText;

  return (
    <section className="message-panel interaction-panel" id="nachrichten" aria-labelledby="message-title">
      <div className="section-heading compact-heading">
        <div><div className="eyebrow">Projektkommunikation</div><h2 id="message-title">{isAdmin ? "Nachricht an den Kunden" : "Nachricht senden"}</h2><p className="muted">{isAdmin ? "Die Nachricht bleibt im Projektverlauf und der Kunde erhält zusätzlich eine E-Mail." : "Für Rückfragen, Hinweise oder Informationen, die im Projektverlauf erhalten bleiben sollen."}</p></div>
        <MessageSquareText size={20} aria-hidden="true" />
      </div>

      <form className="message-form" onSubmit={handleSubmit} aria-busy={sending}>
        <div className="form-field"><label htmlFor="message-project">Projekt</label><select id="message-project" value={projectId} onChange={(event) => setProjectId(event.target.value)} required disabled={sending}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div>
        <div className="form-field"><label htmlFor="project-message">Nachricht</label><textarea id="project-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={4000} rows={5} placeholder={isAdmin ? "Kurzes Update oder Rückfrage an den Kunden …" : "Was soll ich zu deinem Projekt wissen?"} required disabled={sending} /></div>
        <div className="message-actions"><span className="muted note-counter" aria-hidden="true">{message.length}/4000</span><button className="primary-button" type="submit" disabled={sending}>{sending ? <><LoaderCircle className="spin" size={16} aria-hidden="true" />Wird gesendet …</> : "Nachricht senden"}</button></div>
      </form>

      {status ? <div className={`inline-feedback feedback-${tone}`} role={tone === "error" ? "alert" : "status"} aria-live="polite"><FeedbackIcon className={sending ? "spin" : undefined} size={17} aria-hidden="true" /><span>{status}</span></div> : null}
    </section>
  );
}
