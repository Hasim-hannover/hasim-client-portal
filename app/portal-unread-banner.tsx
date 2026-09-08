"use client";

import { MessageSquare, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
};

export function PortalUnreadBanner() {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [notification, setNotification] = useState<NotificationRow | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (pathname !== "/portal") {
      setNotification(null);
      return;
    }

    let active = true;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) return;

      const { data } = await supabase
        .from("portal_notifications")
        .select("id, title, body, created_at")
        .eq("user_id", user.id)
        .is("read_at", null)
        .ilike("title", "%Nachricht%")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (active) setNotification((data as NotificationRow | null) ?? null);
    })();

    return () => {
      active = false;
    };
  }, [pathname, supabase]);

  if (pathname !== "/portal" || !notification) return null;

  async function markRead(scrollToMessages = false) {
    setBusy(true);
    await supabase
      .from("portal_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notification!.id);
    setNotification(null);
    setBusy(false);

    if (scrollToMessages) {
      window.setTimeout(() => {
        document.getElementById("nachrichten")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }
  }

  return (
    <aside className="portal-unread-banner" role="status" aria-live="polite" aria-label="Neue Projektnachricht">
      <div className="portal-unread-icon"><MessageSquare size={18} aria-hidden="true" /></div>
      <div className="portal-unread-copy">
        <strong>Neue Nachricht für dich</strong>
        <span>{notification.body || "Zu deinem Projekt gibt es eine neue Nachricht."}</span>
      </div>
      <button className="portal-unread-action" type="button" onClick={() => void markRead(true)} disabled={busy}>
        Nachricht ansehen
      </button>
      <button className="portal-unread-close" type="button" aria-label="Benachrichtigung schließen" onClick={() => void markRead(false)} disabled={busy}>
        <X size={17} aria-hidden="true" />
      </button>
    </aside>
  );
}
