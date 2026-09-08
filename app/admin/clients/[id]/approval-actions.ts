"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppUrl } from "@/lib/app-url";
import { getPublicPreviewImageUrl, normalizeDemoUrl, type DemoAuthType } from "@/lib/approval-preview";
import { sendTransactionalEmail } from "@/lib/notifications/email";
import { emailInfoCard, emailShell } from "@/lib/notifications/templates";
import { encryptPreviewSecret } from "@/lib/preview-secrets";
import { createClient } from "@/lib/supabase/server";

const allowedPhases = new Set(["onboarding", "content", "concept", "development", "review", "launch", "completed"]);
const allowedAuthTypes = new Set<DemoAuthType>(["none", "shared_password", "basic"]);

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
  redirect(`/admin/clients/${clientId}?${key}=${encodeURIComponent(message)}#approvals`);
}

export async function createApprovalAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const versionLabel = String(formData.get("versionLabel") ?? "").trim();
  const phaseKey = String(formData.get("phaseKey") ?? "");
  const rawDemoUrl = String(formData.get("demoUrl") ?? "").trim();
  const dueAt = String(formData.get("dueAt") ?? "").trim();
  const blocksProgress = formData.get("blocksProgress") === "on";
  const authType = String(formData.get("authType") ?? "none") as DemoAuthType;
  const username = String(formData.get("username") ?? "").trim();
  const secret = String(formData.get("secret") ?? "");

  if (!clientId || !projectId || !title || !rawDemoUrl) backToDossier(clientId, "Bitte Projekt, Titel und Demo-URL angeben.", true);
  if (!allowedPhases.has(phaseKey)) backToDossier(clientId, "Ungültige Projektphase.", true);
  if (!allowedAuthTypes.has(authType)) backToDossier(clientId, "Ungültiger Zugangstyp.", true);
  if (title.length > 160 || description.length > 2000 || versionLabel.length > 80 || username.length > 160 || secret.length > 1000) {
    backToDossier(clientId, "Mindestens ein Feld ist zu lang.", true);
  }
  if (authType === "shared_password" && !secret) backToDossier(clientId, "Bitte das Demo-Passwort angeben.", true);
  if (authType === "basic" && (!username || !secret)) backToDossier(clientId, "Für Basic Auth werden Benutzername und Passwort benötigt.", true);

  let demoUrl: string;
  try {
    demoUrl = normalizeDemoUrl(rawDemoUrl);
  } catch (error) {
    backToDossier(clientId, error instanceof Error ? error.message : "Ungültige Demo-URL.", true);
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, client_id")
    .eq("id", projectId)
    .eq("client_id", clientId)
    .single();
  if (!project) backToDossier(clientId, "Projekt nicht gefunden.", true);

  const previewImageUrl = authType === "none" ? getPublicPreviewImageUrl(demoUrl) : null;
  const { data: action, error: actionError } = await supabase
    .from("project_actions")
    .insert({
      project_id: projectId,
      created_by: user.id,
      title,
      description: description || null,
      action_type: "approval",
      status: "open",
      due_at: dueAt ? new Date(`${dueAt}T23:59:59`).toISOString() : null,
      phase_key: phaseKey,
      version_label: versionLabel || null,
      demo_url: demoUrl,
      preview_image_url: previewImageUrl,
      blocks_progress: blocksProgress,
      demo_auth_type: authType,
    })
    .select("id")
    .single();

  if (actionError || !action) backToDossier(clientId, `Freigabe konnte nicht angelegt werden: ${actionError?.message ?? "Unbekannter Fehler"}`, true);

  if (authType !== "none") {
    try {
      const encrypted = encryptPreviewSecret(secret);
      const { error: secretError } = await supabase.from("project_action_demo_secrets").insert({
        action_id: action.id,
        username: authType === "basic" ? username : null,
        secret_ciphertext: encrypted,
      });
      if (secretError) throw secretError;
    } catch (error) {
      await supabase.from("project_actions").delete().eq("id", action.id);
      backToDossier(clientId, `Freigabe wurde nicht gespeichert, weil der Demo-Zugang nicht sicher hinterlegt werden konnte: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`, true);
    }
  }

  const { data: customer } = await supabase.from("profiles").select("email, full_name").eq("id", clientId).single();
  let emailMessage = "";
  if (customer?.email) {
    const portalUrl = `${getAppUrl()}/portal?action=${encodeURIComponent(action.id)}#action-${action.id}`;
    const result = await sendTransactionalEmail({
      to: customer.email,
      subject: `Freigabe erforderlich – ${project.name}`,
      html: emailShell({
        preheader: `Für ${project.name} steht eine neue Freigabe bereit.`,
        eyebrow: `WERK · ${project.name}`,
        title: "Ein Entwurf steht zur Freigabe bereit.",
        intro: customer.full_name ? `Hallo ${customer.full_name},` : "Hallo,",
        bodyHtml: `${emailInfoCard("Freigabe", title)}${versionLabel ? emailInfoCard("Version", versionLabel) : ""}<p style="margin:0;color:#4b5563">Die Demo, eventuelle Zugangsdaten und die Freigabeentscheidung findest du ausschließlich im geschützten Projektbereich.</p>`,
        ctaLabel: "Entwurf prüfen",
        ctaUrl: portalUrl,
      }),
      idempotencyKey: `portal-approval-customer-${action.id}`,
    });

    await supabase.from("notification_deliveries").insert({
      actor_id: user.id,
      project_id: projectId,
      event_id: action.id,
      kind: "approval_customer",
      recipient_type: "customer",
      recipient_email: customer.email,
      provider: "brevo",
      provider_status: result.status,
      provider_message_id: result.messageId ?? null,
      ok: result.ok,
      error: result.error ?? null,
    });
    if (!result.ok) emailMessage = ` E-Mail-Hinweis: ${result.error ?? `Brevo HTTP ${result.status}`}`;
  }

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/portal");
  backToDossier(clientId, `Freigabe veröffentlicht.${emailMessage}`);
}
