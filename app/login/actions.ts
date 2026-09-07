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
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const message =
      error.code === "invalid_credentials" || error.message === "Invalid login credentials"
        ? "E-Mail oder Passwort stimmt nicht."
        : `Login fehlgeschlagen: ${error.message}`;

    redirect(`/login?error=${encodeURIComponent(message)}`);
  }

  redirect("/portal");
}
