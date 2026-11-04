import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "pocketledger_session";
const SESSION_VERSION = "v1";

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (value && value.length >= 16) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is not set (minimal 16 karakter).");
  }
  return "pocketledger-dev-secret";
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function createSessionToken(ttlMs = 30 * 24 * 60 * 60 * 1000): string {
  const payload = `${SESSION_VERSION}.${Date.now() + ttlMs}`;
  return `${payload}.${sign(payload, secret())}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [version, expiry, signature] = parts;
  if (version !== SESSION_VERSION) return false;
  if (!/^\d+$/.test(expiry) || Number(expiry) < Date.now()) return false;

  let expected: Buffer;
  let received: Buffer;
  try {
    expected = Buffer.from(sign(`${version}.${expiry}`, secret()), "base64url");
    received = Buffer.from(signature, "base64url");
  } catch {
    return false;
  }
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}
