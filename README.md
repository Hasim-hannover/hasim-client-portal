# Hasim Client Portal

Schlankes Kundenportal für den sicheren Austausch von Projektdateien und die spätere Erweiterung um Freigaben, Nachrichten und Projektstatus.

## Stack

- Next.js
- TypeScript
- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Vercel für das erste Deployment

## MVP

1. Login für Kunden
2. Kundenzuordnung zu Projekten
3. Bereiche Dokumente, Bilder und Videos
4. Upload und Download pro Projekt
5. Zugriffsschutz per Row Level Security

## Lokal starten

```bash
npm install
cp .env.example .env.local
npm run dev
```

Danach in `.env.local` die Supabase-Werte eintragen.

## Supabase

Das erste Datenmodell liegt unter `supabase/schema.sql`. Die Datei enthält Tabellen für Profile, Projekte und Projektdateien sowie grundlegende RLS-Regeln.

Keine Secrets in GitHub committen.
