import { createCipheriv, createHash, randomBytes } from "node:crypto";

function credentialKey() {
  const secret = process.env.AMI_CREDENTIAL_SECRET || "ami-demo-credential-secret-change-me";
  return createHash("sha256").update(secret).digest();
}

export function maskCredential(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return "not provided";
  }

  if (normalized.length <= 4) {
    return "****";
  }

  return `${"*".repeat(Math.min(8, normalized.length - 4))}${normalized.slice(-4)}`;
}

export function encryptCredential(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", credentialKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const credentialFingerprint = createHash("sha256").update(value).digest("hex").slice(0, 16);

  return {
    encryptedCredential: `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`,
    credentialFingerprint,
    maskedCredential: maskCredential(value)
  };
}
