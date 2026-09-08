"use server";

import { redirect } from "next/navigation";
import { getAppUrl } from "@/lib/app-url";
import { sendTransactionalEmail } from "@/lib/notifications/email";
import { buildAuthConfirmUrl, emailShell } from "@/lib/notifications/templates";
import { createAdminClient } from "@/lib/supabase/admin";

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    redirect("/forgot-password?error=Bitte%20E-Mail-Adresse%20eingeben.");
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    redirect("/forgot-password?error=Der%20Passwortdienst%20ist%20momentan%20nicht%20verf%C3%BCgbar.");
  }

  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  const hashedToken = data?.properties?.hashed_token;

  if (!error && hashedToken) {
    const accessUrl = buildAuthConfirmUrl(hashedToken, "recovery", getAppUrl());
    const result = await sendTransactionalEmail({
      to: email,
      subject: "Passwort für dein Kundenportal zurücksetzen",
      html: emailShell({
        preheader: "Setze dein Passwort für das Hasim Client Portal neu.",
        eyebrow: "Hasim Client Portal · Sicherheit",
        title: "Neues Passwort festlegen.",
        intro: "Für dein Kundenportal wurde ein neuer Passwort-Link angefordert.",
        bodyHtml: "<p style=\"margin:0;color:#4b5563\">Öffne den sicheren Link und vergib anschließend ein neues Passwort. Falls du die Anfrage nicht selbst gestellt hast, musst du nichts tun.</p>",
        ctaLabel: "Passwort zurücksetzen",
        ctaUrl: accessUrl,
        secondaryText: "Aus Sicherheitsgründen solltest du diesen Link nicht weiterleiten. Falls du keine Passwortänderung angefordert hast, kannst du diese Nachricht ignorieren.",
      }),
      idempotencyKey: `portal-recovery-${crypto.randomUUID()}`,
    });

    await admin.from("notification_deliveries").insert({
      actor_id: null,
      project_id: null,
      event_id: null,
      kind: "recovery",
      recipient_type: "customer",
      recipient_email: email,
      provider: "brevo",
      provider_status: result.status,
      provider_message_id: result.messageId ?? null,
      ok: result.ok,
      error: result.error ?? null,
    });
  }

  // Bewusst immer dieselbe Rückmeldung, damit nicht erkennbar ist, ob eine Adresse registriert ist.
  redirect("/forgot-password?sent=1");
}
