import type { Metadata } from "next";
import "./globals.css";
import "./portal/portal.css";
import "./portal.css";
import "./portal-v2.css";
import "./premium-polish.css";
import "./communication-health.css";
import "./unread-banner.css";
import "./legal.css";
import { PortalUnreadBanner } from "./portal-unread-banner";
import { LegalFooter } from "./legal-footer";

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
      <body>
        <PortalUnreadBanner />
        {children}
        <LegalFooter />
      </body>
    </html>
  );
}
