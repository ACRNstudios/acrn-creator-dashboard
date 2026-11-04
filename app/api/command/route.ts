import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const token = req.cookies.get("acrn_session")?.value;
  if (!token || !(await verifySession(token))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const apiKey = process.env.ROBLOX_API_KEY;
  const universeId = process.env.ROBLOX_UNIVERSE_ID;
  const topic = process.env.ROBLOX_COMMAND_TOPIC || "ACRN_Creator_Commands";
  if (!apiKey || !universeId) {
    return NextResponse.json({ error: "Roblox connection is not configured yet." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (!body || body.type !== "announcement" || typeof body.text !== "string") {
    return NextResponse.json({ error: "Unsupported command." }, { status: 400 });
  }
  const text = body.text.trim();
  if (!text || text.length > 180) {
    return NextResponse.json({ error: "Announcement must be between 1 and 180 characters." }, { status: 400 });
  }

  const message = JSON.stringify({ version: 1, type: "announcement", text, sentAt: Date.now() });
  try {
    const roblox = await fetch(`https://apis.roblox.com/cloud/v2/universes/${encodeURIComponent(universeId)}:publishMessage`, {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ topic, message }),
      cache: "no-store"
    });
    if (!roblox.ok) {
      const detail = await roblox.text();
      console.error("Roblox Open Cloud error:", roblox.status, detail);
      return NextResponse.json({ error: `Roblox rejected the command (HTTP ${roblox.status}). Check the API key permissions and Universe ID.` }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not reach Roblox Open Cloud." }, { status: 502 });
  }
}