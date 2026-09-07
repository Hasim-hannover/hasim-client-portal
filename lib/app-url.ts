const FALLBACK_URL = "https://hasim-client-portal.vercel.app";

export function getAppUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (configured) return configured.replace(/\/$/, "");

  const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProduction) return `https://${vercelProduction.replace(/\/$/, "")}`;

  return FALLBACK_URL;
}
