"use server";

import { redirect } from "next/navigation";
import { getAppUrl } from "@/lib/app-url";
import { escapeHtml, sendTransactionalEmail } from "@/lib/notifications/email";
import { buildAuthConfirmUrl, emailInfoCard, emailShell } from "@/lib/notifications/templates";
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
    ctaLabel?: string;
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
    html: emailShell({
      preheader: input.subject,
      eyebrow: `Hasim Client Portal · ${project.name}`,
      title: input.headline,
      intro: profile.full_name ? `Hallo ${profile.full_name},` : "Hallo,",
      bodyHtml: input.bodyHtml,
      ctaLabel: input.ctaLabel ?? "Kundenportal öffnen",
      ctaUrl: portalUrl,
    }),
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
    bodyHtml: `${emailInfoCard("Projekt", project.name)}${phaseNote ? emailInfoCard("Aktueller Hinweis", phaseNote) : ""}`,
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
    bodyHtml: `${emailInfoCard("Projekt", project?.name ?? "Dein Projekt")}${emailInfoCard("Benötigt", title)}${description ? `<p style="margin:0;color:#4b5563">${escapeHtml(description).replaceAll("\n", "<br>")}</p>` : ""}`,
    ctaLabel: "Anforderung öffnen",
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
  const context = await requireAdmin();
  const { supabase, user } = context;

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const projectName = String(formData.get("projectName") ?? "").trim();

  if (!email || !fullName) adminRedirect("Bitte Name und E-Mail-Adresse angeben.", true);
  if (fullName.length > 160 || projectName.length > 160) adminRedirect("Name oder Projektname ist zu lang.", true);

  const admin = getAdminClientOrRedirect();
  const { data: existingProfile } = await supabase.from("profiles").select("id, role").eq("email", email).maybeSingle();
  if (existingProfile) {
    adminRedirect("Für diese E-Mail existiert bereits ein Konto. Öffne die Kundenakte und sende dort einen neuen Zugangslink.", true);
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { data: { full_name: fullName } },
  });

  const invitedUser = data?.user;
  const hashedToken = data?.properties?.hashed_token;
  if (error || !invitedUser || !hashedToken) {
    adminRedirect(`Konto konnte nicht angelegt werden: ${error?.message ?? "Kein Einladungslink erzeugt."}`, true);
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ full_name: fullName, email, role: "client" })
    .eq("id", invitedUser.id);
  if (profileError) {
    await admin.auth.admin.deleteUser(invitedUser.id).catch(() => undefined);
    adminRedirect(`Kundenprofil konnte nicht angelegt werden: ${profileError.message}`, true);
  }

  let projectId: string | null = null;
  if (projectName) {
    const { data: project, error: projectError } = await admin
      .from("projects")
      .insert({ client_id: invitedUser.id, name: projectName, status: "active", phase: "onboarding" })
      .select("id")
      .single();
    if (projectError || !project) {
      adminRedirect(`Kunde wurde angelegt, Projekt konnte aber nicht erstellt werden: ${projectError?.message ?? "Unbekannter Fehler"}`, true);
    }
    projectId = project.id;
  }

  const accessUrl = buildAuthConfirmUrl(hashedToken, "invite", getAppUrl());
  const result = await sendTransactionalEmail({
    to: email,
    subject: "Dein Zugang zum Hasim Client Portal",
    html: emailShell({
      preheader: "Dein persönlicher Zugang zum Projektbereich ist bereit.",
      eyebrow: "Hasim Client Portal · Einladung",
      title: "Dein Projektbereich ist bereit.",
      intro: `Hallo ${fullName},`,
      bodyHtml: `${projectName ? emailInfoCard("Projekt", projectName) : ""}<p style="margin:0;color:#4b5563">Über den Button legst du dein persönliches Passwort fest. Danach kannst du Projektstatus, Aufgaben, Dateien und Nachrichten zentral im Portal verwalten.</p>`,
      ctaLabel: "Zugang einrichten",
      ctaUrl: accessUrl,
      secondaryText: "Der Zugangslink ist nur für dieses Kundenkonto bestimmt. Wenn du diese Einladung nicht erwartet hast, kannst du die Nachricht ignorieren.",
    }),
    idempotencyKey: `portal-invite-${invitedUser.id}-${crypto.randomUUID()}`,
  });

  await admin.from("notification_deliveries").insert({
    actor_id: user.id,
    project_id: projectId,
    event_id: invitedUser.id,
    kind: "invite",
    recipient_type: "customer",
    recipient_email: email,
    provider: "brevo",
    provider_status: result.status,
    provider_message_id: result.messageId ?? null,
    ok: result.ok,
    error: result.error ?? null,
  });

  if (!result.ok) {
    adminRedirect(`Kunde wurde angelegt, aber die Brevo-Einladung konnte nicht versendet werden: ${result.error ?? `HTTP ${result.status}`}`, true);
  }

  adminRedirect(projectName ? "Kunde angelegt, Projekt erstellt und Brevo-Einladung versendet." : "Kunde angelegt und Brevo-Einladung versendet.");
}

export async function sendBrevoTestEmail() {
  const { supabase, user } = await requireAdmin();
  const recipient = process.env.NOTIFICATION_EMAIL || user.email;
  if (!recipient) adminRedirect("Keine Benachrichtigungsadresse konfiguriert.", true);

  const result = await sendTransactionalEmail({
    to: recipient,
    subject: "Kundenportal – Brevo Systemtest",
    html: emailShell({
      preheader: "Brevo-Verbindung des Kundenportals wurde erfolgreich getestet.",
      eyebrow: "Hasim Client Portal · Systemtest",
      title: "Brevo-Verbindung funktioniert.",
      intro: "Diese Testmail wurde direkt vom produktiven Kundenportal über Brevo versendet.",
      bodyHtml: emailInfoCard("Empfänger", recipient),
    }),
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
