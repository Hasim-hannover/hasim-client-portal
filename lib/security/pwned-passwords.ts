import { createHash } from "node:crypto";

const PWNED_PASSWORDS_RANGE_URL = "https://api.pwnedpasswords.com/range";
const REQUEST_TIMEOUT_MS = 5000;

export class PasswordBreachCheckUnavailableError extends Error {
  constructor() {
    super("Die Passwort-Sicherheitsprüfung ist momentan nicht erreichbar. Bitte versuche es gleich erneut.");
    this.name = "PasswordBreachCheckUnavailableError";
  }
}

export async function getPwnedPasswordCount(password: string): Promise<number> {
  const hash = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${PWNED_PASSWORDS_RANGE_URL}/${prefix}`, {
      method: "GET",
      headers: {
        "Add-Padding": "true",
        "User-Agent": "WERK-Client-Portal/1.0",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) throw new PasswordBreachCheckUnavailableError();

    const body = await response.text();
    const lines = body.split(/\r?\n/);

    for (const line of lines) {
      if (!line) continue;
      const separatorIndex = line.indexOf(":");
      if (separatorIndex === -1) continue;

      const candidateSuffix = line.slice(0, separatorIndex).trim().toUpperCase();
      if (candidateSuffix !== suffix) continue;

      const count = Number(line.slice(separatorIndex + 1).trim());
      return Number.isFinite(count) && count > 0 ? count : 0;
    }

    return 0;
  } catch (error) {
    if (error instanceof PasswordBreachCheckUnavailableError) throw error;
    throw new PasswordBreachCheckUnavailableError();
  } finally {
    clearTimeout(timeout);
  }
}
