import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const VERSION = "v1";

function getEncryptionKey() {
  const source = process.env.PREVIEW_SECRET_ENCRYPTION_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!source) throw new Error("Preview secret encryption is not configured.");
  return createHash("sha256").update(`werk-preview-secret:${VERSION}:${source}`).digest();
}

function encode(value: Buffer) {
  return value.toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url");
}

export function encryptPreviewSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, encode(iv), encode(tag), encode(ciphertext)].join(".");
}

export function decryptPreviewSecret(payload: string) {
  const [version, ivPart, tagPart, ciphertextPart] = payload.split(".");
  if (version !== VERSION || !ivPart || !tagPart || !ciphertextPart) throw new Error("Unsupported preview secret format.");
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), decode(ivPart));
  decipher.setAuthTag(decode(tagPart));
  return Buffer.concat([decipher.update(decode(ciphertextPart)), decipher.final()]).toString("utf8");
}
