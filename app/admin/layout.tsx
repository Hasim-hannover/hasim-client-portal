import Link from "next/link";
import { FolderKanban, Search, Users } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <nav className="admin-quick-dock" aria-label="Admin Schnellnavigation">
        <Link href="/admin/ops"><FolderKanban size={16} aria-hidden="true" />Operations</Link>
        <Link href="/admin/clients"><Users size={16} aria-hidden="true" />Kunden</Link>
        <Link href="/admin/search"><Search size={16} aria-hidden="true" />Suche</Link>
      </nav>
    </>
  );
}
