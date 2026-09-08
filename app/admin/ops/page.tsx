import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AttentionCenter } from "../attention-center";

export const dynamic = "force-dynamic";

export default async function OperationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/portal");

  return (
    <main className="main admin-main operations-workspace" id="main-content">
      <div className="section-heading">
        <div><div className="eyebrow">Client Operations</div><h1>Projekte aktiv steuern.</h1><p className="lead">Hier siehst du nicht nur Daten, sondern was als Nächstes getan werden muss – von dir oder vom Kunden.</p></div>
        <div className="workspace-header-actions"><Link className="secondary-button button-link" href="/admin/search">Suchen</Link><Link className="secondary-button button-link" href="/admin">Admin</Link></div>
      </div>
      <AttentionCenter />
    </main>
  );
}
