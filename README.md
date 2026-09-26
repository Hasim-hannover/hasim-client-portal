# Client Portal

Authentifiziertes Kundenportal für projektbezogene Dateien und eine schrittweise erweiterbare Kundenkommunikation.

Der Fokus liegt nicht auf einem generischen Dashboard, sondern auf einer sauberen technischen Basis: mandantenbezogene Zugriffe, versioniertes Datenmodell, private Dateien und ein reproduzierbarer Deployment-Prozess.

## Architektur

```text
Next.js
  │
  ├── Auth / SSR
  │      ↓
  │   Supabase Auth
  │
  ├── Projektdaten
  │      ↓
  │   Postgres + RLS
  │
  └── Dateien
         ↓
      Private Storage
```

## Stack

- Next.js 16
- React 19
- TypeScript
- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Row Level Security
- Vercel
- ESLint + TypeScript Checks

## Engineering-Prinzipien

- projektbezogene Autorisierung statt nur geschützter Oberfläche
- Datenbankänderungen als versionierte Supabase-Migrationen
- private Storage-Buckets
- keine Secrets im Repository
- Linting, Typecheck und Build als gemeinsamer Qualitätscheck
- Production-Deployment aus `main`

## Lokal starten

```bash
npm install
cp .env.example .env.local
npm run dev
```

Erforderlich sind mindestens:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Qualitätscheck

```bash
npm run check
```

Der Befehl führt Linting, TypeScript-Prüfung und Production-Build nacheinander aus.

## Datenschutz

Das Repository enthält zusätzlich eine dokumentierte Privacy-Readiness-Prüfung. Produktive Kundendaten und Zugangsdaten gehören nicht in Git.
