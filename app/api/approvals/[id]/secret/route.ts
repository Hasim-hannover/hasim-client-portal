import { NextResponse } from "next/server";
import { decryptPreviewSecret } from "@/lib/preview-secrets";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401, headers: { "Cache-Control": "no-store" } });

  const { data: action } = await supabase
    .from("project_actions")
    .select("id, project_id, action_type, demo_auth_type")
    .eq("id", id)
    .single();

  if (!action || action.action_type !== "approval" || action.demo_auth_type === "none") {
    return NextResponse.json({ error: "Keine geschützten Demo-Zugangsdaten vorhanden." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const admin = createAdminClient();
    const { data: secretRow } = await admin
      .from("project_action_demo_secrets")
      .select("username, secret_ciphertext")
      .eq("action_id", action.id)
      .single();

    if (!secretRow) return NextResponse.json({ error: "Zugangsdaten nicht gefunden." }, { status: 404, headers: { "Cache-Control": "no-store" } });

    const secret = decryptPreviewSecret(secretRow.secret_ciphertext);
    return NextResponse.json(
      { username: secretRow.username ?? null, secret },
      { headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" } },
    );
  } catch {
    return NextResponse.json({ error: "Zugangsdaten konnten nicht entschlüsselt werden." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
