import { createHash, timingSafeEqual } from "node:crypto";

// Server-to-server authentication for Roblox telemetry.
// Roblox sends `Authorization: Bearer <secret>`, where the secret comes from the
// experience's Secrets store (HttpService:GetSecret) — never from script source.

export const MIN_TELEMETRY_SECRET_LENGTH = 32;

export type TelemetryAuthResult = "ok" | "invalid" | "not_configured";

export function isTelemetrySecretConfigured(secret = process.env.ROBLOX_TELEMETRY_SECRET): boolean {
  return typeof secret === "string" && secret.length >= MIN_TELEMETRY_SECRET_LENGTH;
}

export function verifyTelemetryAuth(header: string | null, secret = process.env.ROBLOX_TELEMETRY_SECRET): TelemetryAuthResult {
  if (!isTelemetrySecretConfigured(secret)) return "not_configured";
  if (!header || header.length > 512 || !header.startsWith("Bearer ")) return "invalid";
  // Hash both sides so the comparison is constant-time regardless of length.
  const provided = createHash("sha256").update(header.slice(7)).digest();
  const expected = createHash("sha256").update(secret as string).digest();
  return timingSafeEqual(provided, expected) ? "ok" : "invalid";
}
