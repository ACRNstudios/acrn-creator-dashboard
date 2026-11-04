import { jwtVerify } from "jose";

export async function verifySession(token: string): Promise<boolean> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return payload.role === "owner";
  } catch {
    return false;
  }
}