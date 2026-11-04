import type { ServerType } from "@/lib/servers/types";

// Strict validation for heartbeats sent by roblox/ACRNServerMonitor.server.lua.
// Every field is required, unknown fields are rejected, and every number is bounded.

export const HEARTBEAT_MAX_BODY_BYTES = 4096;

export const HEARTBEAT_REASONS = ["startup", "heartbeat", "player_change", "shutdown"] as const;
export type HeartbeatReason = (typeof HEARTBEAT_REASONS)[number];

const SERVER_TYPES: readonly ServerType[] = ["public", "private", "reserved", "studio"];
const JOB_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STUDIO_JOB_ID = /^studio-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_CLOCK_SKEW_SECONDS = 300;
const MAX_SERVER_AGE_SECONDS = 60 * 24 * 60 * 60;
const MAX_PLAYERS_LIMIT = 1000;

export interface HeartbeatPayload {
  version: 1;
  universeId: number;
  placeId: number;
  placeVersion: number;
  jobId: string;
  serverType: ServerType;
  playerCount: number;
  maxPlayers: number;
  /** Unix seconds (server clock) when the Roblox server started. */
  startedAt: number;
  uptimeSeconds: number;
  /** Unix seconds when this report was built. */
  sentAt: number;
  reason: HeartbeatReason;
  /** Cumulative for this server since it started. */
  sessionsCompleted: number;
  sessionSecondsTotal: number;
}

const FIELDS: readonly (keyof HeartbeatPayload)[] = [
  "version", "universeId", "placeId", "placeVersion", "jobId", "serverType", "playerCount", "maxPlayers",
  "startedAt", "uptimeSeconds", "sentAt", "reason", "sessionsCompleted", "sessionSecondsTotal"
];
const ALLOWED = new Set<string>(FIELDS);

export type HeartbeatValidation = { ok: true; value: HeartbeatPayload } | { ok: false; errors: string[] };

export function validateHeartbeat(input: unknown, nowSeconds: number): HeartbeatValidation {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, errors: ["Body must be a JSON object."] };
  }
  const o = input as Record<string, unknown>;
  const errors: string[] = [];

  for (const key of Object.keys(o)) {
    if (!ALLOWED.has(key)) errors.push(`Unknown field: ${key.slice(0, 40)}`);
  }

  const int = (key: keyof HeartbeatPayload, min: number, max: number): number => {
    const v = o[key];
    if (typeof v !== "number" || !Number.isSafeInteger(v) || v < min || v > max) {
      errors.push(`${key} must be an integer between ${min} and ${max}.`);
      return 0;
    }
    return v;
  };

  if (o.version !== 1) errors.push("version must be 1.");
  const universeId = int("universeId", 1, Number.MAX_SAFE_INTEGER);
  const placeId = int("placeId", 1, Number.MAX_SAFE_INTEGER);
  const placeVersion = int("placeVersion", 0, 1_000_000_000);
  const playerCount = int("playerCount", 0, MAX_PLAYERS_LIMIT);
  const maxPlayers = int("maxPlayers", 1, MAX_PLAYERS_LIMIT);
  const sentAt = int("sentAt", nowSeconds - MAX_CLOCK_SKEW_SECONDS, nowSeconds + MAX_CLOCK_SKEW_SECONDS);
  const startedAt = int("startedAt", nowSeconds - MAX_SERVER_AGE_SECONDS, nowSeconds + MAX_CLOCK_SKEW_SECONDS);
  const uptimeSeconds = int("uptimeSeconds", 0, MAX_SERVER_AGE_SECONDS);
  const sessionsCompleted = int("sessionsCompleted", 0, 10_000_000);
  const sessionSecondsTotal = int("sessionSecondsTotal", 0, 1_000_000_000_000);

  const jobId = o.jobId;
  const isStudioId = typeof jobId === "string" && STUDIO_JOB_ID.test(jobId);
  if (typeof jobId !== "string" || !(JOB_ID.test(jobId) || isStudioId)) errors.push("jobId must be a Roblox JobId (GUID).");

  const serverType = o.serverType;
  if (typeof serverType !== "string" || !SERVER_TYPES.includes(serverType as ServerType)) {
    errors.push(`serverType must be one of: ${SERVER_TYPES.join(", ")}.`);
  } else if ((serverType === "studio") !== isStudioId && typeof jobId === "string") {
    errors.push("serverType 'studio' must be used with a studio- jobId, and only then.");
  }

  const reason = o.reason;
  if (typeof reason !== "string" || !(HEARTBEAT_REASONS as readonly string[]).includes(reason)) {
    errors.push(`reason must be one of: ${HEARTBEAT_REASONS.join(", ")}.`);
  }

  if (!errors.length && Math.abs(sentAt - startedAt - uptimeSeconds) > 120) {
    errors.push("uptimeSeconds does not match sentAt - startedAt.");
  }

  if (errors.length) return { ok: false, errors: errors.slice(0, 20) };
  return {
    ok: true,
    value: {
      version: 1, universeId, placeId, placeVersion, jobId: (jobId as string).toLowerCase(),
      serverType: serverType as ServerType, playerCount, maxPlayers, startedAt, uptimeSeconds, sentAt,
      reason: reason as HeartbeatReason, sessionsCompleted, sessionSecondsTotal
    }
  };
}
