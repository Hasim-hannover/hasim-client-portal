import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hasim Client Portal",
  description: "Kundenportal für Projekte, Dokumente, Bilder und Videos",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
