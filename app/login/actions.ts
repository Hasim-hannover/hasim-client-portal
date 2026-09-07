"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=Bitte%20E-Mail%20und%20Passwort%20eingeben.");
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    const message =
      error?.code === "invalid_credentials" || error?.message === "Invalid login credentials"
        ? "E-Mail oder Passwort stimmt nicht."
        : `Login fehlgeschlagen: ${error?.message ?? "Unbekannter Fehler"}`;

    redirect(`/login?error=${encodeURIComponent(message)}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  redirect(profile?.role === "admin" ? "/admin" : "/portal");
}
