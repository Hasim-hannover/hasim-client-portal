"use server";

import { redirect } from "next/navigation";
import {
  getPwnedPasswordCount,
  PasswordBreachCheckUnavailableError,
} from "@/lib/security/pwned-passwords";
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

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    redirect("/forgot-password?error=Die%20Reset-Sitzung%20ist%20abgelaufen.%20Bitte%20fordere%20einen%20neuen%20Link%20an.");
  }

  try {
    const pwnedCount = await getPwnedPasswordCount(password);
    if (pwnedCount > 0) {
      redirect("/account/update-password?error=Dieses%20Passwort%20ist%20in%20bekannten%20Datenlecks%20aufgetaucht.%20Bitte%20w%C3%A4hle%20ein%20anderes%20Passwort.");
    }
  } catch (error) {
    if (error instanceof PasswordBreachCheckUnavailableError) {
      redirect(`/account/update-password?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/account/update-password?error=${encodeURIComponent(error.message)}`);
  }

  await supabase.auth.signOut();
  redirect("/login?message=Passwort%20aktualisiert.%20Du%20kannst%20dich%20jetzt%20anmelden.");
}
