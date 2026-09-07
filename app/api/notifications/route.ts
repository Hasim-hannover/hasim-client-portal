import { NextRequest, NextResponse } from "next/server";
import { getAppUrl } from "@/lib/app-url";
import { createClient } from "@/lib/supabase/server";
import { emailIsConfigured, escapeHtml, sendTransactionalEmail } from "@/lib/notifications/email";

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

function layout(content: string) {
  const portalUrl = `${getAppUrl()}/portal`;
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.55;color:#111318;max-width:620px;margin:0 auto">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin-bottom:20px">Hasim Client Portal</div>
      ${content}
      <p style="margin:24px 0"><a href="${portalUrl}" style="display:inline-block;padding:11px 16px;border-radius:8px;background:#111318;color:#fff;text-decoration:none;font-weight:700">Kundenportal öffnen</a></p>
      <p style="margin-top:28px;color:#6b7280;font-size:13px">Diese Nachricht wurde automatisch vom Kundenportal versendet.</p>
    </div>
  `;
}

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
  const sendJobs: Array<Promise<DeliveryResult>> = [];

  if (kind === "upload") {
    const { data: files, error: filesError } = await supabase
      .from("project_files")
      .select("file_name, category, note, request_id")
      .eq("project_id", projectId)
      .eq("uploader_id", user.id)
      .eq("upload_id", eventId)
      .order("created_at", { ascending: true });

    if (filesError || !files?.length) return NextResponse.json({ error: "Upload nicht gefunden." }, { status: 404 });

    const requestId = files.find((file) => file.request_id)?.request_id ?? null;
    const { data: materialRequest } = requestId
      ? await supabase.from("project_requests").select("title").eq("id", requestId).single()
      : { data: null };

    const category = categoryLabels[files[0].category] ?? "Dateien";
    const note = files.find((file) => file.note?.trim())?.note?.trim() ?? "";
    const fileList = files.map((file) => `<li>${escapeHtml(file.file_name)}</li>`).join("");
    const fileCount = files.length;
    const requestBlock = materialRequest?.title
      ? `<p><strong>Zuordnung:</strong> ${escapeHtml(materialRequest.title)}</p>`
      : "";

    if (senderIsCustomer) {
      sendJobs.push(runDelivery({
        recipient: "owner",
        deliveryKind: "upload_owner",
        recipientEmail: ownerEmail,
        subject: `[${project.name}] ${fileCount} neue ${fileCount === 1 ? "Datei" : "Dateien"}`,
        html: layout(`
          <h1 style="font-size:24px;margin:0 0 16px">Neue Dateien in „${escapeHtml(project.name)}“</h1>
          <p><strong>${escapeHtml(customerName)}</strong> hat ${fileCount} ${fileCount === 1 ? "Datei" : "Dateien"} hochgeladen.</p>
          ${requestBlock}<p><strong>Bereich:</strong> ${escapeHtml(category)}</p><ul>${fileList}</ul>
          ${note ? `<p><strong>Notiz:</strong><br>${escapeHtml(note).replaceAll("\n", "<br>")}</p>` : ""}
        `),
        idempotencyKey: `portal-upload-owner-${eventId}`,
      }));
    }

    if (customerEmail) {
      const customerHtml = senderIsCustomer
        ? layout(`
            <h1 style="font-size:24px;margin:0 0 16px">Upload erfolgreich</h1>
            <p>Deine ${fileCount === 1 ? "Datei wurde" : "Dateien wurden"} für <strong>${escapeHtml(project.name)}</strong> erfolgreich hochgeladen.</p>
            ${requestBlock}<p><strong>Hasim Üner wurde automatisch benachrichtigt.</strong></p>
            ${note ? `<p>Deine Notiz:<br>${escapeHtml(note).replaceAll("\n", "<br>")}</p>` : ""}
          `)
        : layout(`
            <h1 style="font-size:24px;margin:0 0 16px">Neue Dateien verfügbar</h1>
            <p>Für <strong>${escapeHtml(project.name)}</strong> wurden ${fileCount} neue ${fileCount === 1 ? "Datei" : "Dateien"} bereitgestellt.</p>
            ${requestBlock}<ul>${fileList}</ul>${note ? `<p><strong>Notiz:</strong><br>${escapeHtml(note).replaceAll("\n", "<br>")}</p>` : ""}
          `);

      sendJobs.push(runDelivery({
        recipient: "customer",
        deliveryKind: "upload_customer",
        recipientEmail: customerEmail,
        subject: senderIsCustomer ? `Upload bestätigt – ${project.name}` : `Neue Dateien – ${project.name}`,
        html: customerHtml,
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
        html: layout(`
          <h1 style="font-size:24px;margin:0 0 16px">Neue Projektnachricht</h1>
          <p><strong>${escapeHtml(customerName)}</strong> hat zu <strong>${escapeHtml(project.name)}</strong> geschrieben:</p>
          <div style="padding:14px 16px;background:#f5f6f8;border-radius:10px">${escapeHtml(message.body).replaceAll("\n", "<br>")}</div>
        `),
        idempotencyKey: `portal-message-owner-${eventId}`,
      }));
    }

    if (customerEmail) {
      sendJobs.push(runDelivery({
        recipient: "customer",
        deliveryKind: "message_customer",
        recipientEmail: customerEmail,
        subject: senderIsCustomer ? `Nachricht bestätigt – ${project.name}` : `Neue Nachricht – ${project.name}`,
        html: senderIsCustomer
          ? layout(`<h1 style="font-size:24px;margin:0 0 16px">Nachricht gespeichert</h1><p>Deine Nachricht zu <strong>${escapeHtml(project.name)}</strong> wurde gespeichert.</p><p><strong>Hasim Üner wurde automatisch benachrichtigt.</strong></p>`)
          : layout(`<h1 style="font-size:24px;margin:0 0 16px">Neue Nachricht zu deinem Projekt</h1><p>Zu <strong>${escapeHtml(project.name)}</strong> gibt es eine neue Nachricht:</p><div style="padding:14px 16px;background:#f5f6f8;border-radius:10px">${escapeHtml(message.body).replaceAll("\n", "<br>")}</div>`),
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
