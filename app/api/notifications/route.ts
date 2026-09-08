import { NextRequest, NextResponse } from "next/server";
import { getAppUrl } from "@/lib/app-url";
import { createClient } from "@/lib/supabase/server";
import { emailIsConfigured, sendTransactionalEmail } from "@/lib/notifications/email";
import { emailFileList, emailInfoCard, emailQuote, emailShell } from "@/lib/notifications/templates";

type NotificationRequest = {
  kind?: "upload" | "message";
  projectId?: string;
  eventId?: string;
};

type Recipient = "owner" | "customer";
type DeliveryKind = "upload_owner" | "upload_customer" | "message_owner" | "message_customer";
type DeliveryResult = {
  recipient: Recipient;
  deliveryKind: DeliveryKind;
  recipientEmail: string;
  ok: boolean;
  status: number;
  error?: string;
  messageId?: string;
};

const categoryLabels: Record<string, string> = {
  document: "Dokumente & PDF",
  image: "Bilder & Grafiken",
  video: "Videos",
  other: "Sonstiges",
};

async function runDelivery(args: {
  recipient: Recipient;
  deliveryKind: DeliveryKind;
  recipientEmail: string;
  subject: string;
  html: string;
  idempotencyKey: string;
}): Promise<DeliveryResult> {
  const result = await sendTransactionalEmail({
    to: args.recipientEmail,
    subject: args.subject,
    html: args.html,
    idempotencyKey: args.idempotencyKey,
  });
  return { recipient: args.recipient, deliveryKind: args.deliveryKind, recipientEmail: args.recipientEmail, ...result };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as NotificationRequest | null;
  const kind = body?.kind;
  const projectId = body?.projectId;
  const eventId = body?.eventId;

  if (!kind || !projectId || !eventId || !["upload", "message"].includes(kind)) {
    return NextResponse.json({ error: "Ungültige Benachrichtigung." }, { status: 400 });
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name, client_id")
    .eq("id", projectId)
    .single();
  if (projectError || !project) return NextResponse.json({ error: "Projekt nicht gefunden." }, { status: 404 });

  const { data: clientProfile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", project.client_id)
    .single();

  const customerEmail = clientProfile?.email ?? (project.client_id === user.id ? user.email : null);
  const customerName = clientProfile?.full_name || customerEmail || "Kunde";
  const ownerEmail = process.env.NOTIFICATION_EMAIL;
  if (!emailIsConfigured() || !ownerEmail) return NextResponse.json({ configured: false, sent: 0 });

  const senderIsCustomer = project.client_id === user.id;
  const portalUrl = `${getAppUrl()}/portal`;
  const adminUrl = `${getAppUrl()}/admin/ops`;
  const sendJobs: Array<Promise<DeliveryResult>> = [];

  if (kind === "upload") {
    const { data: files, error: filesError } = await supabase
      .from("project_files")
      .select("file_name, category, note, request_id, action_id")
      .eq("project_id", projectId)
      .eq("uploader_id", user.id)
      .eq("upload_id", eventId)
      .order("created_at", { ascending: true });

    if (filesError || !files?.length) return NextResponse.json({ error: "Upload nicht gefunden." }, { status: 404 });

    const actionId = files.find((file) => file.action_id)?.action_id ?? null;
    const requestId = files.find((file) => file.request_id)?.request_id ?? null;
    const [{ data: action }, { data: materialRequest }] = await Promise.all([
      actionId ? supabase.from("project_actions").select("title").eq("id", actionId).single() : Promise.resolve({ data: null }),
      requestId ? supabase.from("project_requests").select("title").eq("id", requestId).single() : Promise.resolve({ data: null }),
    ]);

    const assignmentTitle = action?.title || materialRequest?.title || null;
    const category = categoryLabels[files[0].category] ?? "Dateien";
    const note = files.find((file) => file.note?.trim())?.note?.trim() ?? "";
    const fileNames = files.map((file) => file.file_name);
    const fileCount = files.length;
    const commonBody = `${emailInfoCard("Projekt", project.name)}${assignmentTitle ? emailInfoCard("Zuordnung", assignmentTitle) : ""}${emailInfoCard("Bereich", category)}${emailFileList(fileNames)}${note ? emailInfoCard("Notiz", note) : ""}`;

    if (senderIsCustomer) {
      sendJobs.push(runDelivery({
        recipient: "owner",
        deliveryKind: "upload_owner",
        recipientEmail: ownerEmail,
        subject: `[${project.name}] ${fileCount} neue ${fileCount === 1 ? "Datei" : "Dateien"}`,
        html: emailShell({
          preheader: `${customerName} hat neue Dateien für ${project.name} hochgeladen.`,
          eyebrow: "Hasim Client Portal · Kundenupload",
          title: `${fileCount} neue ${fileCount === 1 ? "Datei" : "Dateien"}`,
          intro: `${customerName} hat neue Projektdateien hochgeladen.`,
          bodyHtml: commonBody,
          ctaLabel: "Im Admin prüfen",
          ctaUrl: adminUrl,
        }),
        idempotencyKey: `portal-upload-owner-${eventId}`,
      }));
    }

    if (customerEmail) {
      sendJobs.push(runDelivery({
        recipient: "customer",
        deliveryKind: "upload_customer",
        recipientEmail: customerEmail,
        subject: senderIsCustomer ? `Upload bestätigt – ${project.name}` : `Neue Dateien – ${project.name}`,
        html: emailShell({
          preheader: senderIsCustomer ? `Dein Upload für ${project.name} war erfolgreich.` : `Neue Projektdateien sind für ${project.name} verfügbar.`,
          eyebrow: senderIsCustomer ? "Hasim Client Portal · Upload bestätigt" : "Hasim Client Portal · Neue Dateien",
          title: senderIsCustomer ? "Upload erfolgreich." : "Neue Dateien sind verfügbar.",
          intro: senderIsCustomer
            ? "Deine Dateien wurden sicher gespeichert. Hasim wurde automatisch informiert."
            : "Für dein Projekt wurden neue Dateien bereitgestellt.",
          bodyHtml: commonBody,
          ctaLabel: "Dateien im Portal öffnen",
          ctaUrl: `${portalUrl}#dateien`,
        }),
        idempotencyKey: `portal-upload-customer-${eventId}`,
      }));
    }
  }

  if (kind === "message") {
    const { data: message, error: messageError } = await supabase
      .from("project_messages")
      .select("body")
      .eq("id", eventId)
      .eq("project_id", projectId)
      .eq("sender_id", user.id)
      .single();
    if (messageError || !message) return NextResponse.json({ error: "Nachricht nicht gefunden." }, { status: 404 });

    if (senderIsCustomer) {
      sendJobs.push(runDelivery({
        recipient: "owner",
        deliveryKind: "message_owner",
        recipientEmail: ownerEmail,
        subject: `[${project.name}] Neue Projektnachricht`,
        html: emailShell({
          preheader: `${customerName} hat eine neue Projektnachricht gesendet.`,
          eyebrow: "Hasim Client Portal · Nachricht",
          title: "Neue Nachricht vom Kunden.",
          intro: `${customerName} hat zu ${project.name} geschrieben:`,
          bodyHtml: `${emailInfoCard("Projekt", project.name)}${emailQuote(message.body)}`,
          ctaLabel: "Nachricht beantworten",
          ctaUrl: adminUrl,
        }),
        idempotencyKey: `portal-message-owner-${eventId}`,
      }));
    }

    if (customerEmail) {
      sendJobs.push(runDelivery({
        recipient: "customer",
        deliveryKind: "message_customer",
        recipientEmail: customerEmail,
        subject: senderIsCustomer ? `Nachricht bestätigt – ${project.name}` : `Neue Nachricht – ${project.name}`,
        html: emailShell({
          preheader: senderIsCustomer ? `Deine Nachricht zu ${project.name} wurde gespeichert.` : `Neue Nachricht zu ${project.name}.`,
          eyebrow: "Hasim Client Portal · Kommunikation",
          title: senderIsCustomer ? "Nachricht gespeichert." : "Neue Projektnachricht.",
          intro: senderIsCustomer
            ? "Deine Nachricht wurde im Projektverlauf gespeichert und Hasim automatisch informiert."
            : `Es gibt ein neues Update zu ${project.name}:`,
          bodyHtml: `${emailInfoCard("Projekt", project.name)}${emailQuote(message.body)}`,
          ctaLabel: "Kommunikation öffnen",
          ctaUrl: `${portalUrl}#nachrichten`,
        }),
        idempotencyKey: `portal-message-customer-${eventId}`,
      }));
    }
  }

  const results = await Promise.all(sendJobs);
  const failed = results.filter((result) => !result.ok);

  if (results.length) {
    const { error: logError } = await supabase.from("notification_deliveries").insert(
      results.map((result) => ({
        actor_id: user.id,
        project_id: projectId,
        event_id: eventId,
        kind: result.deliveryKind,
        recipient_type: result.recipient,
        recipient_email: result.recipientEmail,
        provider: "brevo",
        provider_status: result.status,
        provider_message_id: result.messageId ?? null,
        ok: result.ok,
        error: result.error ?? null,
      })),
    );
    if (logError) console.error("Notification delivery log failed", logError.message);
  }

  return NextResponse.json({
    configured: true,
    sent: results.length - failed.length,
    failed: failed.map(({ recipient, status, error }) => ({ recipient, status, error })),
  }, { status: failed.length ? 207 : 200 });
}
