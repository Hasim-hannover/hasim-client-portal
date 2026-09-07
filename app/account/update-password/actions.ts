"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  if (password.length < 8) {
    redirect("/account/update-password?error=Das%20Passwort%20muss%20mindestens%208%20Zeichen%20lang%20sein.");
  }

  if (password !== passwordConfirm) {
    redirect("/account/update-password?error=Die%20Passw%C3%B6rter%20stimmen%20nicht%20%C3%BCberein.");
  }

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    redirect("/forgot-password?error=Die%20Reset-Sitzung%20ist%20abgelaufen.%20Bitte%20fordere%20einen%20neuen%20Link%20an.");
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/account/update-password?error=${encodeURIComponent(error.message)}`);
  }

  await supabase.auth.signOut();
  redirect("/login?message=Passwort%20aktualisiert.%20Du%20kannst%20dich%20jetzt%20anmelden.");
}
