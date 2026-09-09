export type DemoAuthType = "none" | "shared_password" | "basic";

export function normalizeDemoUrl(raw: string) {
  const value = raw.trim();
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Demo-URL muss mit http:// oder https:// beginnen.');
  return url.toString();
}

export function getPublicPreviewImageUrl(demoUrl: string) {
  return `https://s0.wp.com/mshots/v1/${encodeURIComponent(demoUrl)}?w=1200`;
}

export function getDemoHost(demoUrl: string) {
  try {
    return new URL(demoUrl).host;
  } catch {
    return demoUrl;
  }
}
