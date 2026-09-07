"use server";

import { redirect } from "next/navigation";
import { getAppUrl } from "@/lib/app-url";
import { createClient } from "@/lib/supabase/server";

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    redirect("/forgot-password?error=Bitte%20E-Mail-Adresse%20eingeben.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getAppUrl()}/auth/confirm?next=/account/update-password`,
  });

  if (error) {
    redirect(`/forgot-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/forgot-password?sent=1");
}
