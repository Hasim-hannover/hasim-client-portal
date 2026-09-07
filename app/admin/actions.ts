"use server";

import { headers } from "next/headers";
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

function adminRedirect(message: string, error = false) {
  const key = error ? "error" : "message";
  redirect(`/admin?${key}=${encodeURIComponent(message)}`);
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

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Admin-Zugang fehlt.";
    adminRedirect(message, true);
  }

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
