import { createHash, randomBytes } from "node:crypto";

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  const secret = process.env.AMI_SESSION_SECRET || "ami-demo-session-secret-change-me";
  return createHash("sha256").update(`${secret}:${token}`).digest("hex");
}
