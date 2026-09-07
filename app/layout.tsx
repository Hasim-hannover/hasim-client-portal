import type { Metadata } from "next";
import "./globals.css";
import "./portal/portal.css";
import "./portal.css";

export const metadata: Metadata = {
  title: "Hasim Client Portal",
  description: "Kundenportal für Projekte, Dateien, Notizen und Nachrichten",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
