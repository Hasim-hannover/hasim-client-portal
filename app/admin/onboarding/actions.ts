"use server";

import { redirect } from "next/navigation";
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/portal");
  return { supabase };
}

function onboardingRedirect(message: string, error = false): never {
  const key = error ? "error" : "message";
  redirect(`/admin/onboarding?${key}=${encodeURIComponent(message)}`);
}

function getAdminClient() {
  try {
    return createAdminClient();
  } catch (error) {
    onboardingRedirect(error instanceof Error ? error.message : "Supabase Admin-Zugang fehlt.", true);
  }
}

export async function createClientWorkspace(formData: FormData) {
  const { supabase } = await requireAdmin();

  const fullName = String(formData.get("fullName") ?? "").trim();
  const companyName = String(formData.get("companyName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const projectName = String(formData.get("projectName") ?? "").trim();
  const phase = String(formData.get("phase") ?? "onboarding");
  const phaseNote = String(formData.get("phaseNote") ?? "").trim();

  if (!fullName || !email || !projectName) {
    onboardingRedirect("Bitte Name, E-Mail-Adresse und Projektname angeben.", true);
  }
  if (!allowedPhases.has(phase)) onboardingRedirect("Ungültige Startphase.", true);
  if (fullName.length > 160 || companyName.length > 160 || projectName.length > 160 || phaseNote.length > 1200) {
    onboardingRedirect("Mindestens ein Feld ist zu lang.", true);
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile) {
    onboardingRedirect("Für diese E-Mail existiert bereits ein Konto. Öffne die Kundenakte und lege dort ein weiteres Projekt an.", true);
  }

  const admin = getAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { data: { full_name: fullName } },
  });

  const client = data?.user;
  if (error || !client) {
    onboardingRedirect(`Kundenkonto konnte nicht vorbereitet werden: ${error?.message ?? "Unbekannter Fehler"}`, true);
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      full_name: fullName,
      company_name: companyName || null,
      email,
      role: "client",
    })
    .eq("id", client.id);

  if (profileError) {
    await admin.auth.admin.deleteUser(client.id).catch(() => undefined);
    onboardingRedirect(`Kundenprofil konnte nicht vorbereitet werden: ${profileError.message}`, true);
  }

  const { data: project, error: projectError } = await admin
    .from("projects")
    .insert({
      client_id: client.id,
      name: projectName,
      status: "active",
      phase,
      phase_note: phaseNote || null,
    })
    .select("id")
    .single();

  if (projectError || !project) {
    await admin.auth.admin.deleteUser(client.id).catch(() => undefined);
    onboardingRedirect(`Projektraum konnte nicht angelegt werden: ${projectError?.message ?? "Unbekannter Fehler"}`, true);
  }

  redirect(`/admin/clients/${client.id}?message=${encodeURIComponent("Projektraum vorbereitet. Du kannst jetzt Inhalte, Dateien und Freigaben hinterlegen und erst danach die Einladung senden.")}`);
}
