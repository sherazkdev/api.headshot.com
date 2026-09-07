import crypto from "node:crypto";

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function maskKey(prefix: string): string {
  if (prefix.length <= 16) return `${prefix}...`;
  return `${prefix.slice(0, 22)}...`;
}
