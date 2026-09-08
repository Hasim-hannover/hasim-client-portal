"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const allowedStatuses = new Set(["open", "submitted", "verified", "not_needed"]);

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/portal");
  return { supabase, user };
}

function backToDossier(clientId: string, message: string, error = false): never {
  const key = error ? "error" : "message";
  redirect(`/admin/clients/${clientId}?${key}=${encodeURIComponent(message)}#project-start`);
}

export async function updateStartRequirement(formData: FormData) {
  const { supabase } = await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  const requirementId = String(formData.get("requirementId") ?? "");
  const status = String(formData.get("status") ?? "");
  const adminNote = String(formData.get("adminNote") ?? "").trim();
  const isRequired = formData.get("isRequired") === "on";

  if (!clientId || !requirementId || !allowedStatuses.has(status)) backToDossier(clientId, "Ungültige Startvoraussetzung.", true);
  if (adminNote.length > 1200) backToDossier(clientId, "Der interne Hinweis darf maximal 1.200 Zeichen lang sein.", true);

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("project_start_requirements")
    .update({
      status,
      is_required: isRequired,
      admin_note: adminNote || null,
      completed_at: ["verified", "not_needed"].includes(status) ? now : null,
      updated_at: now,
    })
    .eq("id", requirementId);

  if (error) backToDossier(clientId, `Startvoraussetzung konnte nicht gespeichert werden: ${error.message}`, true);
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/portal");
  backToDossier(clientId, "Startvoraussetzung aktualisiert.");
}

export async function startProject(formData: FormData) {
  const { supabase } = await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  if (!clientId || !projectId) backToDossier(clientId, "Projekt fehlt.", true);

  const [{ data: project }, { data: requirements, error: requirementsError }] = await Promise.all([
    supabase.from("projects").select("id, started_at").eq("id", projectId).eq("client_id", clientId).single(),
    supabase.from("project_start_requirements").select("id, title, is_required, status").eq("project_id", projectId),
  ]);

  if (!project) backToDossier(clientId, "Projekt nicht gefunden.", true);
  if (project.started_at) backToDossier(clientId, "Projekt wurde bereits gestartet.");
  if (requirementsError) backToDossier(clientId, `Startvoraussetzungen konnten nicht geprüft werden: ${requirementsError.message}`, true);

  const blockers = (requirements ?? []).filter((item) => item.is_required && !["verified", "not_needed"].includes(item.status));
  if (blockers.length) {
    backToDossier(clientId, `Projektstart blockiert: ${blockers.map((item) => item.title).join(", ")}.`, true);
  }

  const { error } = await supabase
    .from("projects")
    .update({ started_at: new Date().toISOString(), phase: "onboarding", phase_note: "Projekt gestartet · Kick-off & Bestandsaufnahme" })
    .eq("id", projectId)
    .eq("client_id", clientId);

  if (error) backToDossier(clientId, `Projekt konnte nicht gestartet werden: ${error.message}`, true);
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/portal");
  backToDossier(clientId, "Projekt gestartet. Phase 1 ist aktiv.");
}

export async function markInvoicePayment(formData: FormData) {
  const { supabase } = await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const fileId = String(formData.get("fileId") ?? "");
  const paymentStatus = String(formData.get("paymentStatus") ?? "");
  if (!clientId || !projectId || !fileId || !["open", "paid"].includes(paymentStatus)) backToDossier(clientId, "Ungültiger Rechnungsstatus.", true);

  const paidAt = paymentStatus === "paid" ? new Date().toISOString() : null;
  const { error } = await supabase
    .from("project_files")
    .update({ invoice_payment_status: paymentStatus, invoice_paid_at: paidAt })
    .eq("id", fileId)
    .eq("project_id", projectId)
    .eq("document_type", "invoice");

  if (error) backToDossier(clientId, `Rechnung konnte nicht aktualisiert werden: ${error.message}`, true);

  if (paymentStatus === "paid") {
    await supabase
      .from("project_start_requirements")
      .update({ status: "verified", completed_at: paidAt, updated_at: paidAt })
      .eq("project_id", projectId)
      .eq("requirement_key", "invoice_paid");
  }

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/portal");
  backToDossier(clientId, paymentStatus === "paid" ? "Zahlungseingang bestätigt." : "Rechnung wieder als offen markiert.");
}
