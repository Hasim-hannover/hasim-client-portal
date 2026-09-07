"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
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

async function requireAdmin() {
  const supabase = createClient();
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

export async function updateProjectPhase(formData: FormData) {
  const { supabase } = await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  const phase = String(formData.get("phase") ?? "");
  const phaseNote = String(formData.get("phaseNote") ?? "").trim();

  if (!projectId || !allowedPhases.has(phase)) {
    adminRedirect("Ungültige Projektphase.", true);
  }

  if (phaseNote.length > 1200) {
    adminRedirect("Der Phasenhinweis darf maximal 1.200 Zeichen lang sein.", true);
  }

  const { error } = await supabase
    .from("projects")
    .update({ phase, phase_note: phaseNote || null })
    .eq("id", projectId);

  if (error) adminRedirect(`Projektphase konnte nicht gespeichert werden: ${error.message}`, true);
  adminRedirect("Projektphase aktualisiert.");
}

export async function createProject(formData: FormData) {
  const { supabase } = await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!clientId || !name) {
    adminRedirect("Bitte Kunde und Projektname angeben.", true);
  }

  const { error } = await supabase.from("projects").insert({
    client_id: clientId,
    name,
    status: "active",
    phase: "onboarding",
  });

  if (error) adminRedirect(`Projekt konnte nicht erstellt werden: ${error.message}`, true);
  adminRedirect("Projekt erstellt.");
}

export async function inviteClient(formData: FormData) {
  await requireAdmin();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const projectName = String(formData.get("projectName") ?? "").trim();

  if (!email || !fullName) {
    adminRedirect("Bitte Name und E-Mail-Adresse angeben.", true);
  }

  const admin = getAdminClientOrRedirect();
  const headerStore = headers();
  const origin = headerStore.get("origin") ?? "https://hasim-client-portal.vercel.app";

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${origin}/account/update-password`,
  });

  if (error || !data.user) {
    adminRedirect(`Einladung konnte nicht versendet werden: ${error?.message ?? "Unbekannter Fehler"}`, true);
  }

  await admin
    .from("profiles")
    .update({ full_name: fullName, email, role: "client" })
    .eq("id", data.user.id);

  if (projectName) {
    const { error: projectError } = await admin.from("projects").insert({
      client_id: data.user.id,
      name: projectName,
      status: "active",
      phase: "onboarding",
    });

    if (projectError) {
      adminRedirect(`Kunde eingeladen, Projekt konnte aber nicht erstellt werden: ${projectError.message}`, true);
    }
  }

  adminRedirect(projectName ? "Kunde eingeladen und Projekt angelegt." : "Kunde eingeladen.");
}

export async function sendBrevoTestEmail() {
  const { supabase, user } = await requireAdmin();
  const recipient = process.env.NOTIFICATION_EMAIL || user.email;

  if (!recipient) {
    adminRedirect("Keine Benachrichtigungsadresse konfiguriert.", true);
  }

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

  if (!result.ok) {
    adminRedirect(`Brevo-Test fehlgeschlagen (${result.status || "Netzwerk"}): ${result.error ?? "Unbekannter Fehler"}`, true);
  }

  adminRedirect(`Brevo-Testmail an ${recipient} wurde angenommen.`);
}
