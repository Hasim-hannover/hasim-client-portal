"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppUrl } from "@/lib/app-url";
import { sendTransactionalEmail } from "@/lib/notifications/email";
import { emailInfoCard, emailShell } from "@/lib/notifications/templates";
import { createClient } from "@/lib/supabase/server";

const allowedTypes = new Set(["upload", "approval", "info"]);
const allowedStatuses = new Set(["open", "submitted", "approved", "changes_requested", "done"]);

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/portal");
  return { supabase, user };
}

function back(message: string, error = false): never {
  redirect(`/admin?${error ? "error" : "message"}=${encodeURIComponent(message)}#attention`);
}

export async function createClientAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const actionType = String(formData.get("actionType") ?? "upload");
  const dueDate = String(formData.get("dueDate") ?? "").trim();

  if (!projectId || !title || !allowedTypes.has(actionType)) back("Bitte Projekt, Aufgabe und gültigen Typ angeben.", true);
  if (title.length > 160 || description.length > 2000) back("Die Aufgabe ist zu lang.", true);

  const dueAt = dueDate ? new Date(`${dueDate}T18:00:00`).toISOString() : null;
  const { data: action, error } = await supabase
    .from("project_actions")
    .insert({
      project_id: projectId,
      created_by: user.id,
      title,
      description: description || null,
      action_type: actionType,
      due_at: dueAt,
    })
    .select("id, project_id, title, description, action_type, due_at")
    .single();

  if (error || !action) back(`Aufgabe konnte nicht erstellt werden: ${error?.message ?? "Unbekannter Fehler"}`, true);

  const { data: project } = await supabase.from("projects").select("name, client_id").eq("id", projectId).single();
  const { data: client } = project
    ? await supabase.from("profiles").select("email, full_name").eq("id", project.client_id).single()
    : { data: null };

  let mailOk = false;
  let mailReason = "Keine Kunden-E-Mail hinterlegt.";
  if (client?.email && project) {
    const typeLabel = actionType === "approval" ? "Freigabe" : actionType === "info" ? "Bestätigung" : "Upload";
    const dueLabel = dueAt ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(dueAt)) : null;
    const result = await sendTransactionalEmail({
      to: client.email,
      subject: `Neue Aufgabe – ${project.name}`,
      html: emailShell({
        preheader: `${title} – neuer nächster Schritt im Projekt ${project.name}.`,
        eyebrow: `Hasim Client Portal · ${typeLabel}`,
        title,
        intro: client.full_name ? `Hallo ${client.full_name},` : "Hallo,",
        bodyHtml: `${emailInfoCard("Projekt", project.name)}${dueLabel ? emailInfoCard("Fällig", dueLabel) : ""}${description ? `<p style=\"margin:0;color:#4b5563\">${description.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\n", "<br>")}</p>` : ""}`,
        ctaLabel: "Aufgabe öffnen",
        ctaUrl: `${getAppUrl()}/portal#action-${action.id}`,
      }),
      idempotencyKey: `portal-action-${action.id}`,
    });

    mailOk = result.ok;
    mailReason = result.error ?? `Brevo HTTP ${result.status}`;

    await supabase.from("notification_deliveries").insert({
      actor_id: user.id,
      project_id: projectId,
      event_id: action.id,
      kind: "action_customer",
      recipient_type: "customer",
      recipient_email: client.email,
      provider: "brevo",
      provider_status: result.status,
      provider_message_id: result.messageId ?? null,
      ok: result.ok,
      error: result.error ?? null,
    });
  }

  revalidatePath("/portal");
  back(mailOk ? "Aufgabe erstellt und Kunde per E-Mail informiert." : `Aufgabe erstellt. E-Mail-Hinweis: ${mailReason}`);
}

export async function updateClientActionStatus(formData: FormData) {
  const { supabase } = await requireAdmin();
  const actionId = String(formData.get("actionId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!actionId || !allowedStatuses.has(status)) back("Ungültiger Aufgabenstatus.", true);

  const { error } = await supabase
    .from("project_actions")
    .update({
      status,
      completed_at: ["approved", "done"].includes(status) ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", actionId);

  if (error) back(`Aufgabe konnte nicht aktualisiert werden: ${error.message}`, true);
  revalidatePath("/portal");
  back("Aufgabe aktualisiert.");
}
