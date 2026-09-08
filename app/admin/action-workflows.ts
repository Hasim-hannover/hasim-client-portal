"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppUrl } from "@/lib/app-url";
import { escapeHtml, sendTransactionalEmail } from "@/lib/notifications/email";
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
    .select("id, project_id, title, description, action_type")
    .single();

  if (error || !action) back(`Aufgabe konnte nicht erstellt werden: ${error?.message ?? "Unbekannter Fehler"}`, true);

  const [{ data: project }, { data: client }] = await Promise.all([
    supabase.from("projects").select("name, client_id").eq("id", projectId).single(),
    supabase.from("profiles").select("email, full_name").eq("id", (await supabase.from("projects").select("client_id").eq("id", projectId).single()).data?.client_id ?? "").single(),
  ]);

  if (client?.email && project) {
    const typeLabel = actionType === "approval" ? "Freigabe" : actionType === "info" ? "Bestätigung" : "Upload";
    const result = await sendTransactionalEmail({
      to: client.email,
      subject: `Neue Aufgabe – ${project.name}`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#111318;max-width:620px;margin:0 auto"><div style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin-bottom:20px">Hasim Client Portal · ${typeLabel}</div><h1 style="font-size:24px;margin:0 0 16px">${escapeHtml(title)}</h1><p>Hallo ${escapeHtml(client.full_name || "")},</p>${description ? `<p>${escapeHtml(description).replaceAll("\n", "<br>")}</p>` : ""}<p style="margin:24px 0"><a href="${getAppUrl()}/portal#action-${action.id}" style="display:inline-block;padding:11px 16px;border-radius:8px;background:#111318;color:#fff;text-decoration:none;font-weight:700">Aufgabe öffnen</a></p></div>`,
      idempotencyKey: `portal-action-${action.id}`,
    });

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
  back("Aufgabe erstellt und Kunde informiert.");
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
