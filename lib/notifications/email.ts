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
    process.env.BREVO_API_KEY &&
      process.env.BREVO_FROM_EMAIL &&
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
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_FROM_EMAIL;
  const fromName = process.env.BREVO_FROM_NAME || "Hasim Üner";

  if (!apiKey || !fromEmail) {
    return { ok: false, status: 503, error: "E-Mail-Versand ist noch nicht konfiguriert." };
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: {
        email: fromEmail,
        name: fromName,
      },
      to: [{ email: input.to }],
      subject: input.subject,
      htmlContent: input.html,
      headers: {
        "Idempotency-Key": input.idempotencyKey,
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const error = (await response.text()).slice(0, 500);
    return { ok: false, status: response.status, error };
  }

  return { ok: true, status: response.status };
}
