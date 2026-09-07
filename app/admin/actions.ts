"use server";

import { redirect } from "next/navigation";
import { getAppUrl } from "@/lib/app-url";
import { escapeHtml, sendTransactionalEmail } from "@/lib/notifications/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const allowedPhases = new Set([
  "onboarding",
  "content",
  "concept",
  "development",
  "review",
  "launch",
  "completed",
]);

const phaseLabels: Record<string, string> = {
  onboarding: "Onboarding",
  content: "Inhalte & Material",
  concept: "Konzept",
  development: "Umsetzung",
  review: "Prüfung & Freigabe",
  launch: "Launch",
  completed: "Abgeschlossen",
};

const allowedRequestStatuses = new Set(["open", "submitted", "done"]);

type AdminContext = Awaited<ReturnType<typeof requireAdmin>>;

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/portal");
  return { supabase, user };
}

function adminRedirect(message: string, error = false): never {
  const key = error ? "error" : "message";
  redirect(`/admin?${key}=${encodeURIComponent(message)}`);
}

function getAdminClientOrRedirect(): ReturnType<typeof createAdminClient> {
  try {
    return createAdminClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Admin-Zugang fehlt.";
    adminRedirect(message, true);
  }
}

async function sendCustomerWorkflowEmail(
  context: AdminContext,
  input: {
    projectId: string;
    eventId: string;
    kind: "request_customer" | "phase_customer";
    subject: string;
    headline: string;
    bodyHtml: string;
  },
) {
  const { supabase, user } = context;
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, client_id")
    .eq("id", input.projectId)
    .single();

  if (!project) return { sent: false, reason: "Projekt nicht gefunden." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", project.client_id)
    .single();

  if (!profile?.email) return { sent: false, reason: "Beim Kunden ist keine E-Mail-Adresse hinterlegt." };

  const portalUrl = `${getAppUrl()}/portal`;
  const result = await sendTransactionalEmail({
    to: profile.email,
    subject: input.subject,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#111318;max-width:620px;margin:0 auto">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin-bottom:20px">Hasim Client Portal</div>
        <h1 style="font-size:24px;margin:0 0 16px">${escapeHtml(input.headline)}</h1>
        <p>Hallo ${escapeHtml(profile.full_name || "")},</p>
        ${input.bodyHtml}
        <p style="margin:24px 0"><a href="${portalUrl}" style="display:inline-block;padding:11px 16px;border-radius:8px;background:#111318;color:#fff;text-decoration:none;font-weight:700">Kundenportal öffnen</a></p>
        <p style="margin-top:28px;color:#6b7280;font-size:13px">Diese Nachricht wurde automatisch vom Kundenportal versendet.</p>
      </div>
    `,
    idempotencyKey: `portal-${input.kind}-${input.eventId}`,
  });

  await supabase.from("notification_deliveries").insert({
    actor_id: user.id,
    project_id: project.id,
    event_id: input.eventId,
    kind: input.kind,
    recipient_type: "customer",
    recipient_email: profile.email,
    provider: "brevo",
    provider_status: result.status,
    provider_message_id: result.messageId ?? null,
    ok: result.ok,
    error: result.error ?? null,
  });

  return result.ok
    ? { sent: true, reason: null }
    : { sent: false, reason: result.error ?? `Brevo HTTP ${result.status}` };
}

export async function updateProjectPhase(formData: FormData) {
  const context = await requireAdmin();
  const { supabase } = context;
  const projectId = String(formData.get("projectId") ?? "");
  const phase = String(formData.get("phase") ?? "");
  const phaseNote = String(formData.get("phaseNote") ?? "").trim();

  if (!projectId || !allowedPhases.has(phase)) adminRedirect("Ungültige Projektphase.", true);
  if (phaseNote.length > 1200) adminRedirect("Der Phasenhinweis darf maximal 1.200 Zeichen lang sein.", true);

  const { data: project, error } = await supabase
    .from("projects")
    .update({ phase, phase_note: phaseNote || null })
    .eq("id", projectId)
    .select("id, name")
    .single();

  if (error || !project) adminRedirect(`Projektphase konnte nicht gespeichert werden: ${error?.message ?? "Unbekannter Fehler"}`, true);

  const mail = await sendCustomerWorkflowEmail(context, {
    projectId,
    eventId: `${projectId}-${phase}-${Date.now()}`,
    kind: "phase_customer",
    subject: `Projektstatus aktualisiert – ${project.name}`,
    headline: `Neue Projektphase: ${phaseLabels[phase] ?? phase}`,
    bodyHtml: `<p>Der Status von <strong>${escapeHtml(project.name)}</strong> wurde aktualisiert.</p>${phaseNote ? `<p><strong>Aktueller Hinweis:</strong><br>${escapeHtml(phaseNote).replaceAll("\n", "<br>")}</p>` : ""}`,
  });

  adminRedirect(mail.sent ? "Projektphase aktualisiert und Kunde benachrichtigt." : `Projektphase aktualisiert. E-Mail-Hinweis: ${mail.reason}`);
}

export async function createProject(formData: FormData) {
  const { supabase } = await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!clientId || !name) adminRedirect("Bitte Kunde und Projektname angeben.", true);
  if (name.length > 160) adminRedirect("Der Projektname ist zu lang.", true);

  const { error } = await supabase.from("projects").insert({
    client_id: clientId,
    name,
    status: "active",
    phase: "onboarding",
  });

  if (error) adminRedirect(`Projekt konnte nicht erstellt werden: ${error.message}`, true);
  adminRedirect("Projekt erstellt.");
}

export async function createProjectRequest(formData: FormData) {
  const context = await requireAdmin();
  const { supabase, user } = context;
  const projectId = String(formData.get("projectId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!projectId || !title) adminRedirect("Bitte Projekt und benötigtes Material angeben.", true);
  if (title.length > 160 || description.length > 1200) adminRedirect("Die Material-Anforderung ist zu lang.", true);

  const { data: request, error } = await supabase
    .from("project_requests")
    .insert({ project_id: projectId, created_by: user.id, title, description: description || null })
    .select("id")
    .single();

  if (error || !request) adminRedirect(`Anforderung konnte nicht erstellt werden: ${error?.message ?? "Unbekannter Fehler"}`, true);

  const { data: project } = await supabase.from("projects").select("name").eq("id", projectId).single();
  const mail = await sendCustomerWorkflowEmail(context, {
    projectId,
    eventId: request.id,
    kind: "request_customer",
    subject: `Unterlagen benötigt – ${project?.name ?? "Projekt"}`,
    headline: "Neue Material-Anforderung",
    bodyHtml: `<p>Für <strong>${escapeHtml(project?.name ?? "dein Projekt")}</strong> benötige ich noch:</p><p><strong>${escapeHtml(title)}</strong></p>${description ? `<p>${escapeHtml(description).replaceAll("\n", "<br>")}</p>` : ""}`,
  });

  adminRedirect(mail.sent ? "Material angefordert und Kunde benachrichtigt." : `Material angefordert. E-Mail-Hinweis: ${mail.reason}`);
}

export async function updateProjectRequestStatus(formData: FormData) {
  const { supabase } = await requireAdmin();
  const requestId = String(formData.get("requestId") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!requestId || !allowedRequestStatuses.has(status)) adminRedirect("Ungültiger Anforderungsstatus.", true);

  const { error } = await supabase.from("project_requests").update({ status }).eq("id", requestId);
  if (error) adminRedirect(`Anforderung konnte nicht aktualisiert werden: ${error.message}`, true);
  adminRedirect("Material-Anforderung aktualisiert.");
}

export async function inviteClient(formData: FormData) {
  await requireAdmin();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const projectName = String(formData.get("projectName") ?? "").trim();

  if (!email || !fullName) adminRedirect("Bitte Name und E-Mail-Adresse angeben.", true);

  const admin = getAdminClientOrRedirect();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${getAppUrl()}/account/update-password`,
  });

  if (error || !data.user) adminRedirect(`Einladung konnte nicht versendet werden: ${error?.message ?? "Unbekannter Fehler"}`, true);

  await admin.from("profiles").update({ full_name: fullName, email, role: "client" }).eq("id", data.user.id);

  if (projectName) {
    const { error: projectError } = await admin.from("projects").insert({
      client_id: data.user.id,
      name: projectName,
      status: "active",
      phase: "onboarding",
    });
    if (projectError) adminRedirect(`Kunde eingeladen, Projekt konnte aber nicht erstellt werden: ${projectError.message}`, true);
  }

  adminRedirect(projectName ? "Kunde eingeladen und Projekt angelegt." : "Kunde eingeladen.");
}

export async function sendBrevoTestEmail() {
  const { supabase, user } = await requireAdmin();
  const recipient = process.env.NOTIFICATION_EMAIL || user.email;
  if (!recipient) adminRedirect("Keine Benachrichtigungsadresse konfiguriert.", true);

  const result = await sendTransactionalEmail({
    to: recipient,
    subject: "Kundenportal – Brevo Systemtest",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#111318;max-width:620px;margin:0 auto">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin-bottom:20px">Hasim Client Portal</div>
        <h1 style="font-size:24px;margin:0 0 16px">Brevo-Verbindung funktioniert</h1>
        <p>Diese Testmail wurde direkt vom produktiven Kundenportal über Brevo versendet.</p>
        <p><strong>Empfänger:</strong> ${escapeHtml(recipient)}</p>
      </div>
    `,
    idempotencyKey: `portal-system-test-${crypto.randomUUID()}`,
  });

  await supabase.from("notification_deliveries").insert({
    actor_id: user.id,
    project_id: null,
    event_id: null,
    kind: "test",
    recipient_type: "test",
    recipient_email: recipient,
    provider: "brevo",
    provider_status: result.status,
    provider_message_id: result.messageId ?? null,
    ok: result.ok,
    error: result.error ?? null,
  });

  if (!result.ok) adminRedirect(`Brevo-Test fehlgeschlagen (${result.status || "Netzwerk"}): ${result.error ?? "Unbekannter Fehler"}`, true);
  adminRedirect(`Brevo-Testmail an ${recipient} wurde angenommen.`);
}
