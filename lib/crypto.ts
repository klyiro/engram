import crypto from "node:crypto";
import { AUTH_SECRET } from "@/lib/config";

function key(): Buffer | null {
  if (!AUTH_SECRET) return null;
  return crypto.createHash("sha256").update(AUTH_SECRET).digest();
}

/** Encrypt a secret (e.g. a git token) at rest with AES-256-GCM keyed off AUTH_SECRET.
 *  Falls back to base64 (obfuscated, not encrypted) when AUTH_SECRET is unset (local dev). */
export function encryptSecret(plain: string): string {
  const k = key();
  if (!k) return `plain:${Buffer.from(plain, "utf8").toString("base64")}`;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", k, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `gcm:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptSecret(stored: string): string {
  if (stored.startsWith("plain:")) return Buffer.from(stored.slice(6), "base64").toString("utf8");
  const [, ivB, tagB, dataB] = stored.split(":");
  const k = key();
  if (!k) throw new Error("AUTH_SECRET required to decrypt stored secret");
  const decipher = crypto.createDecipheriv("aes-256-gcm", k, Buffer.from(ivB, "base64"));
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB, "base64")), decipher.final()]).toString("utf8");
}
