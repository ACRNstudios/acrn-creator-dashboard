import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { scryptSync, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

function verifyPassword(password: string, stored: string) {
  // Format: scrypt$<salt hex>$<derived-key hex>
  const [scheme, salt, expectedHex] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !expectedHex) return false;
  try {
    const expected = Buffer.from(expectedHex, "hex");
    const actual = scryptSync(password, salt, expected.length);
    return expected.length > 0 && actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch { return false; }
}

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({}));
  const stored = process.env.ADMIN_PASSWORD_HASH;
  const secret = process.env.SESSION_SECRET;
  if (!stored || !secret) return NextResponse.json({ error: "Dashboard authentication is not configured." }, { status: 503 });
  if (typeof password !== "string" || !verifyPassword(password, stored)) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }
  const key = new TextEncoder().encode(secret);
  const token = await new SignJWT({ role: "owner" }).setProtectedHeader({ alg: "HS256" })
    .setIssuedAt().setExpirationTime("12h").sign(key);
  const response = NextResponse.json({ ok: true });
  response.cookies.set("acrn_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 60 * 60 * 12 });
  return response;
}