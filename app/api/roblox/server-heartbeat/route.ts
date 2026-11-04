import { after, NextRequest, NextResponse } from "next/server";
import { DatabaseNotConfiguredError } from "@/lib/db";
import { verifyTelemetryAuth } from "@/lib/monitoring/auth";
import { getMonitoringConfig, getPrimaryUniverseId } from "@/lib/monitoring/config";
import { HEARTBEAT_MAX_BODY_BYTES, validateHeartbeat } from "@/lib/monitoring/heartbeat";
import { pruneOldData, recordHeartbeat } from "@/lib/monitoring/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Roughly 1 in N accepted heartbeats also prunes expired history (keeps storage bounded without a cron). */
const PRUNE_ONE_IN = 200;

const json = (body: unknown, status: number, headers?: Record<string, string>) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

// Receives heartbeats from roblox/ACRNServerMonitor.server.lua.
// Server-to-server only: requires ROBLOX_TELEMETRY_SECRET as a Bearer token.
export async function POST(req: NextRequest) {
  // 1. Authenticate before reading or parsing anything.
  const auth = verifyTelemetryAuth(req.headers.get("authorization"));
  if (auth === "not_configured") return json({ error: "Telemetry is not configured on the dashboard." }, 503);
  if (auth !== "ok") return json({ error: "Unauthorized." }, 401);

  // 2. Bound the body size.
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > HEARTBEAT_MAX_BODY_BYTES) return json({ error: "Payload too large." }, 413);
  const raw = await req.text();
  if (Buffer.byteLength(raw, "utf8") > HEARTBEAT_MAX_BODY_BYTES) return json({ error: "Payload too large." }, 413);

  // 3. Parse and validate every field.
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return json({ error: "Malformed JSON." }, 400); }
  const result = validateHeartbeat(body, Math.floor(Date.now() / 1000));
  if (!result.ok) return json({ error: "Invalid heartbeat.", details: result.errors }, 400);

  // 4. Only accept servers from the configured experience.
  const universeId = getPrimaryUniverseId();
  if (universeId === null) return json({ error: "ROBLOX_UNIVERSE_ID is not configured on the dashboard." }, 503);
  if (result.value.universeId !== universeId) return json({ error: "Universe not allowed." }, 403);

  // 5. Store (upsert + history bucket), with a per-server rate limit enforced in SQL.
  const cfg = getMonitoringConfig();
  try {
    const outcome = await recordHeartbeat(result.value, cfg);
    if (outcome === "rate_limited") {
      return json({ error: "Too many reports for this server.", retryAfterSeconds: cfg.minReportIntervalSeconds }, 429, { "Retry-After": String(cfg.minReportIntervalSeconds) });
    }
    if (Math.random() * PRUNE_ONE_IN < 1) {
      after(() => pruneOldData(cfg).catch(err => console.error("[monitoring] prune failed:", err)));
    }
    return json({ ok: true, created: outcome === "created", heartbeatIntervalSeconds: cfg.heartbeatIntervalSeconds }, 200);
  } catch (err) {
    if (err instanceof DatabaseNotConfiguredError) return json({ error: "Dashboard storage is not configured." }, 503);
    console.error("[monitoring] heartbeat write failed:", err);
    return json({ error: "Storage error." }, 500);
  }
}
