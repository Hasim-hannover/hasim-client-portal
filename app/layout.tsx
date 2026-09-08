import type { Metadata } from "next";
import "./globals.css";
import "./portal/portal.css";
import "./portal.css";
import "./portal-v2.css";

export const metadata: Metadata = {
  title: {
    default: "Hasim Client Portal",
    template: "%s | Hasim Client Portal",
  },
  description: "Geschützter Kundenbereich für Projekte, Dateien, Anforderungen und Nachrichten.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
