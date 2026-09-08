"use server";

import { redirect } from "next/navigation";
import { getAppUrl } from "@/lib/app-url";
import { sendTransactionalEmail } from "@/lib/notifications/email";
import { buildAuthConfirmUrl, emailShell } from "@/lib/notifications/templates";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/portal");
  return { supabase, user };
}

function dossierRedirect(clientId: string, message: string, error = false): never {
  const key = error ? "error" : "message";
  redirect(`/admin/clients/${clientId}?${key}=${encodeURIComponent(message)}`);
}

function listRedirect(message: string, error = false): never {
  const key = error ? "error" : "message";
  redirect(`/admin/clients?${key}=${encodeURIComponent(message)}`);
}

function getAdminClient(clientId: string) {
  try {
    return createAdminClient();
  } catch (error) {
    dossierRedirect(clientId, error instanceof Error ? error.message : "Supabase Admin-Zugang fehlt.", true);
  }
}

export async function updateClientProfile(formData: FormData) {
  const { supabase } = await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const companyName = String(formData.get("companyName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!clientId || !fullName) dossierRedirect(clientId || "unknown", "Name und Kunde sind erforderlich.", true);
  if (fullName.length > 160 || companyName.length > 160 || phone.length > 80) {
    dossierRedirect(clientId, "Mindestens ein Feld ist zu lang.", true);
  }

  const { data: client } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", clientId)
    .single();

  if (!client || client.role !== "client") dossierRedirect(clientId, "Kunde wurde nicht gefunden.", true);

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      company_name: companyName || null,
      phone: phone || null,
    })
    .eq("id", clientId);

  if (error) dossierRedirect(clientId, `Kundendaten konnten nicht gespeichert werden: ${error.message}`, true);
  dossierRedirect(clientId, "Kundendaten gespeichert.");
}

export async function sendClientAccessLink(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) listRedirect("Kunde fehlt.", true);

  const { data: client } = await supabase
    .from("profiles")
    .select("id, role, email, full_name, company_name")
    .eq("id", clientId)
    .single();

  if (!client || client.role !== "client" || !client.email) dossierRedirect(clientId, "Für diesen Kunden ist keine gültige E-Mail hinterlegt.", true);

  const admin = getAdminClient(clientId);
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email: client.email });
  const hashedToken = data?.properties?.hashed_token;
  if (error || !hashedToken) dossierRedirect(clientId, `Zugangslink konnte nicht erzeugt werden: ${error?.message ?? "Unbekannter Fehler"}`, true);

  const accessUrl = buildAuthConfirmUrl(hashedToken, "recovery", getAppUrl());
  const name = client.full_name || client.company_name || "Kunde";
  const result = await sendTransactionalEmail({
    to: client.email,
    subject: "Neuer Zugangslink zu deinem Kundenportal",
    html: emailShell({
      preheader: "Dein neuer sicherer Zugangslink zum Kundenportal.",
      eyebrow: "Hasim Client Portal · Zugang",
      title: "Dein neuer Zugangslink ist bereit.",
      intro: `Hallo ${name},`,
      bodyHtml: "<p style=\"margin:0;color:#4b5563\">Über den Button kannst du ein neues Passwort festlegen und anschließend direkt auf deinen geschützten Projektbereich zugreifen.</p>",
      ctaLabel: "Zugang einrichten",
      ctaUrl: accessUrl,
      secondaryText: "Der Link ist nur für dieses Kundenkonto bestimmt. Wenn du keinen neuen Zugangslink erwartet hast, kannst du diese Nachricht ignorieren.",
    }),
    idempotencyKey: `portal-access-${client.id}-${crypto.randomUUID()}`,
  });

  await supabase.from("notification_deliveries").insert({
    actor_id: user.id,
    project_id: null,
    event_id: client.id,
    kind: "recovery",
    recipient_type: "customer",
    recipient_email: client.email,
    provider: "brevo",
    provider_status: result.status,
    provider_message_id: result.messageId ?? null,
    ok: result.ok,
    error: result.error ?? null,
  });

  if (!result.ok) dossierRedirect(clientId, `Zugangslink wurde erzeugt, aber Brevo konnte die E-Mail nicht versenden: ${result.error ?? `HTTP ${result.status}`}`, true);
  dossierRedirect(clientId, "Neuer Zugangslink wurde über Brevo versendet.");
}

export async function deleteClient(formData: FormData) {
  const { supabase } = await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  if (!clientId) listRedirect("Kunde fehlt.", true);

  const { data: client } = await supabase
    .from("profiles")
    .select("id, role, client_number, full_name, company_name")
    .eq("id", clientId)
    .single();

  if (!client || client.role !== "client") listRedirect("Kunde wurde nicht gefunden.", true);
  const expected = client.client_number || "LÖSCHEN";
  if (confirmation !== expected) dossierRedirect(clientId, `Bitte zur Bestätigung exakt „${expected}“ eingeben.`, true);

  const admin = getAdminClient(clientId);
  const { data: projects } = await admin.from("projects").select("id").eq("client_id", clientId);
  const projectIds = (projects ?? []).map((project) => project.id);

  if (projectIds.length) {
    const { data: files, error: fileError } = await admin
      .from("project_files")
      .select("storage_path")
      .in("project_id", projectIds);
    if (fileError) dossierRedirect(clientId, `Dateien konnten vor dem Löschen nicht geprüft werden: ${fileError.message}`, true);

    const storagePaths = Array.from(new Set((files ?? []).map((file) => file.storage_path).filter(Boolean)));
    for (let index = 0; index < storagePaths.length; index += 100) {
      const { error: storageError } = await admin.storage.from("project-files").remove(storagePaths.slice(index, index + 100));
      if (storageError) dossierRedirect(clientId, `Dateien konnten nicht vollständig gelöscht werden: ${storageError.message}`, true);
    }
  }

  const { error } = await admin.auth.admin.deleteUser(clientId);
  if (error) dossierRedirect(clientId, `Kundenkonto konnte nicht gelöscht werden: ${error.message}`, true);

  const label = client.company_name || client.full_name || client.client_number || "Kunde";
  listRedirect(`${label} wurde vollständig gelöscht.`);
}
