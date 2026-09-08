import { escapeHtml } from "./email";

type EmailShellInput = {
  preheader: string;
  eyebrow?: string;
  title: string;
  intro?: string;
  bodyHtml?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  secondaryText?: string;
};

function safeLines(value: string) {
  return escapeHtml(value).replaceAll("\n", "<br>");
}

export function emailShell({
  preheader,
  eyebrow = "Hasim Client Portal",
  title,
  intro,
  bodyHtml = "",
  ctaLabel,
  ctaUrl,
  secondaryText = "Diese Nachricht wurde automatisch vom geschützten Kundenportal versendet. Aus Datenschutzgründen gehören vertrauliche Inhalte ausschließlich ins Portal.",
}: EmailShellInput) {
  const action = ctaLabel && ctaUrl
    ? `<tr><td style="padding:8px 0 6px"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:13px 18px;border-radius:10px;background:#111827;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;line-height:1.2">${escapeHtml(ctaLabel)}</a></td></tr>`
    : "";

  return `<!doctype html>
<html lang="de">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;background:#f4f6f8;color:#111827;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f6f8;padding:28px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#ffffff;border:1px solid #e2e6eb;border-radius:18px;overflow:hidden;box-shadow:0 12px 38px rgba(17,24,39,.06)">
          <tr><td style="padding:28px 30px 12px">
            <div style="font-size:11px;line-height:1.4;text-transform:uppercase;letter-spacing:.12em;color:#6b7280;font-weight:700">${escapeHtml(eyebrow)}</div>
            <h1 style="margin:9px 0 0;font-size:27px;line-height:1.18;letter-spacing:-.02em;color:#111827">${escapeHtml(title)}</h1>
          </td></tr>
          <tr><td style="padding:8px 30px 26px">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              ${intro ? `<tr><td style="padding:0 0 18px;font-size:15px;line-height:1.65;color:#4b5563">${safeLines(intro)}</td></tr>` : ""}
              ${bodyHtml ? `<tr><td style="padding:0 0 18px;font-size:15px;line-height:1.65;color:#1f2937">${bodyHtml}</td></tr>` : ""}
              ${action}
            </table>
          </td></tr>
          <tr><td style="padding:18px 30px 24px;border-top:1px solid #edf0f3;font-size:12px;line-height:1.55;color:#7b8492">${escapeHtml(secondaryText)}<br><a href="https://hasim-client-portal.vercel.app/datenschutz" style="color:#5b6472;text-decoration:underline">Datenschutzhinweise</a></td></tr>
        </table>
        <div style="max-width:640px;padding:14px 8px 0;font-size:11px;line-height:1.5;color:#8b93a1;text-align:center">Hasim Üner · Client Operations Workspace</div>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function emailInfoCard(label: string, value: string) {
  return `<div style="margin:0 0 14px;padding:14px 16px;border:1px solid #e5e7eb;border-radius:12px;background:#f8fafc"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;font-weight:700">${escapeHtml(label)}</div><div style="margin-top:5px;font-size:15px;line-height:1.5;color:#111827;font-weight:650">${safeLines(value)}</div></div>`;
}

export function emailQuote(value: string) {
  return `<div style="margin:0 0 14px;padding:14px 16px;border-left:3px solid #111827;border-radius:0 10px 10px 0;background:#f7f8fa;font-size:15px;line-height:1.6;color:#273142">${safeLines(value)}</div>`;
}

export function emailFileList(fileNames: string[]) {
  if (!fileNames.length) return "";
  return `<div style="margin:0 0 14px;padding:14px 16px;border:1px solid #e5e7eb;border-radius:12px;background:#f8fafc"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;font-weight:700;margin-bottom:7px">Dateien</div><ul style="margin:0;padding-left:20px;color:#1f2937">${fileNames.map((name) => `<li style="margin:4px 0">${escapeHtml(name)}</li>`).join("")}</ul></div>`;
}

export function buildAuthConfirmUrl(hashedToken: string, type: "invite" | "recovery", appUrl: string) {
  const url = new URL("/auth/confirm", appUrl);
  url.searchParams.set("token_hash", hashedToken);
  url.searchParams.set("type", type);
  url.searchParams.set("next", "/account/update-password");
  return url.toString();
}
