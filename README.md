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

Danach in `.env.local` diese Variablen eintragen:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Supabase

Das Datenmodell wird versioniert über Migrationen unter `supabase/migrations/` verwaltet. Enthalten sind Profile, Projekte, Projektdateien, Row Level Security und der private Storage-Bucket für Projektdateien.

## Deployment

`main` ist der Production-Branch. Pushes auf `main` lösen das Vercel-Deployment aus; Supabase übernimmt Datenbankänderungen aus `supabase/migrations/`.

Keine Secrets in GitHub committen.
