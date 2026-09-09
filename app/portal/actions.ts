"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppUrl } from "@/lib/app-url";
import { sendTransactionalEmail } from "@/lib/notifications/email";
import { emailInfoCard, emailShell } from "@/lib/notifications/templates";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

async function notifyOwnerAboutAction(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  actionId: string;
  stateLabel: string;
}) {
  const ownerEmail = process.env.NOTIFICATION_EMAIL;
  if (!ownerEmail) return;

  const { data: action } = await input.supabase
    .from("project_actions")
    .select("id, project_id, title, action_type, status")
    .eq("id", input.actionId)
    .single();
  if (!action) return;

  const [{ data: project }, { data: profile }] = await Promise.all([
    input.supabase.from("projects").select("id, name, client_id").eq("id", action.project_id).single(),
    input.supabase.from("profiles").select("full_name, company_name, email").eq("id", input.userId).single(),
  ]);
  if (!project || project.client_id !== input.userId) return;

  const customerName = profile?.company_name || profile?.full_name || profile?.email || "Kunde";
  const result = await sendTransactionalEmail({
    to: ownerEmail,
    subject: `[${project.name}] ${input.stateLabel}: ${action.title}`,
    html: emailShell({
      preheader: `${customerName} hat eine Kundenaufgabe aktualisiert.`,
      eyebrow: "Hasim Client Portal · Kundenaktion",
      title: input.stateLabel,
      intro: `${customerName} hat eine Aufgabe im Projekt aktualisiert. Antworten und Feedback bleiben aus Datenschutzgründen im geschützten Portal.`,
      bodyHtml: `${emailInfoCard("Projekt", project.name)}${emailInfoCard("Aufgabe", action.title)}`,
      ctaLabel: "Sicher im Admin öffnen",
      ctaUrl: `${getAppUrl()}/admin/ops`,
    }),
    idempotencyKey: `portal-action-response-${action.id}-${action.status}-${crypto.randomUUID()}`,
  });

  await input.supabase.from("notification_deliveries").insert({
    actor_id: input.userId,
    project_id: project.id,
    event_id: action.id,
    kind: "action_response_owner",
    recipient_type: "owner",
    recipient_email: ownerEmail,
    provider: "brevo",
    provider_status: result.status,
    provider_message_id: result.messageId ?? null,
    ok: result.ok,
    error: result.error ?? null,
  });
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function respondToApproval(formData: FormData) {
  const { supabase, user } = await requireUser();
  const actionId = String(formData.get("actionId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!actionId || !["approved", "changes_requested"].includes(decision) || note.length > 2000) return;
  const { data: updated, error } = await supabase.rpc("respond_project_approval", {
    p_action_id: actionId,
    p_decision: decision,
    p_note: note || null,
  });
  if (error || !updated) return;

  await notifyOwnerAboutAction({
    supabase,
    userId: user.id,
    actionId,
    stateLabel: decision === "approved" ? "Freigabe erteilt" : "Änderungen angefordert",
  });
  revalidatePath("/portal");
  revalidatePath("/admin/ops");
}

export async function completeInfoAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const actionId = String(formData.get("actionId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!actionId || note.length > 2000) return;
  const { data: updated, error } = await supabase.rpc("complete_project_action", { p_action_id: actionId, p_note: note || null });
  if (error || !updated) return;

  await notifyOwnerAboutAction({
    supabase,
    userId: user.id,
    actionId,
    stateLabel: "Aufgabe bestätigt",
  });
  revalidatePath("/portal");
  revalidatePath("/admin/ops");
}

export async function submitStartRequirement(formData: FormData) {
  const { supabase } = await requireUser();
  const requirementId = String(formData.get("requirementId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!requirementId || note.length > 1200) return;

  const { data: updated, error } = await supabase.rpc("submit_project_start_requirement", {
    p_requirement_id: requirementId,
    p_note: note || null,
  });
  if (error || !updated) return;
  revalidatePath("/portal");
  revalidatePath("/admin");
  revalidatePath("/admin/clients");
}

export async function markNotificationRead(formData: FormData) {
  const { supabase, user } = await requireUser();
  const notificationId = String(formData.get("notificationId") ?? "");
  if (!notificationId) return;
  await supabase
    .from("portal_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", user.id);
  revalidatePath("/portal");
}

export async function markAllNotificationsRead() {
  const { supabase, user } = await requireUser();
  await supabase
    .from("portal_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  revalidatePath("/portal");
}
