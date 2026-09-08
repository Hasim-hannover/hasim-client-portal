"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function respondToApproval(formData: FormData) {
  const { supabase } = await requireUser();
  const actionId = String(formData.get("actionId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!actionId || !["approved", "changes_requested"].includes(decision)) return;
  await supabase.rpc("respond_project_approval", {
    p_action_id: actionId,
    p_decision: decision,
    p_note: note || null,
  });
  revalidatePath("/portal");
}

export async function completeInfoAction(formData: FormData) {
  const { supabase } = await requireUser();
  const actionId = String(formData.get("actionId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!actionId) return;
  await supabase.rpc("complete_project_action", { p_action_id: actionId, p_note: note || null });
  revalidatePath("/portal");
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
