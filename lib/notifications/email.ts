type EmailInput = {
  to: string;
  subject: string;
  html: string;
  idempotencyKey: string;
};

type EmailResult = {
  ok: boolean;
  status: number;
  error?: string;
};

export function emailIsConfigured() {
  return Boolean(
    process.env.RESEND_API_KEY &&
      process.env.RESEND_FROM_EMAIL &&
      process.env.NOTIFICATION_EMAIL,
  );
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendTransactionalEmail(input: EmailInput): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    return { ok: false, status: 503, error: "E-Mail-Versand ist noch nicht konfiguriert." };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const error = (await response.text()).slice(0, 500);
    return { ok: false, status: response.status, error };
  }

  return { ok: true, status: response.status };
}
