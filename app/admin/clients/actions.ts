"use server";

import { redirect } from "next/navigation";
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
  return supabase;
}

function dossierRedirect(clientId: string, message: string, error = false): never {
  const key = error ? "error" : "message";
  redirect(`/admin/clients/${clientId}?${key}=${encodeURIComponent(message)}`);
}

export async function updateClientProfile(formData: FormData) {
  const supabase = await requireAdmin();
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
