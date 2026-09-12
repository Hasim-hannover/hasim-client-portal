import type { Metadata } from "next";
import { PrivacyContent } from "./privacy-content";

export const metadata: Metadata = {
  title: "Datenschutz",
  description: "Datenschutzhinweise für das Hasim Client Portal.",
};

export default function DatenschutzPage() {
  return (
    <main className="legal-shell" id="main-content">
      <article className="legal-page">
        <PrivacyContent />
      </article>
    </main>
  );
}
