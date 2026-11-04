import type { ServerHealth } from "@/lib/servers/types";

// Heartbeat timing. The heartbeat endpoint returns heartbeatIntervalSeconds to
// every Roblox server, so changing it here (via env) re-tunes the game too.

export interface MonitoringConfig {
  heartbeatIntervalSeconds: number;
  staleAfterSeconds: number;
  offlineAfterSeconds: number;
  /** Per-server minimum gap between accepted reports (rate limit). Shutdown reports bypass it. */
  minReportIntervalSeconds: number;
  /** Width of a player-count history bucket. */
  sampleBucketSeconds: number;
  /** Servers last seen within this window are listed on the dashboard. */
  listWindowHours: number;
  historyRetentionDays: number;
  serverRetentionDays: number;
}

type Env = Record<string, string | undefined>;

function intFromEnv(env: Env, name: string, fallback: number, min: number, max: number): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    console.warn(`[monitoring] Ignoring invalid ${name}=${raw}; using ${fallback}.`);
    return fallback;
  }
  return n;
}

export function getMonitoringConfig(env: Env = process.env): MonitoringConfig {
  const heartbeatIntervalSeconds = intFromEnv(env, "SERVER_HEARTBEAT_INTERVAL_SECONDS", 30, 15, 300);
  let staleAfterSeconds = intFromEnv(env, "SERVER_STALE_AFTER_SECONDS", heartbeatIntervalSeconds * 2 + 15, 20, 1800);
  let offlineAfterSeconds = intFromEnv(env, "SERVER_OFFLINE_AFTER_SECONDS", heartbeatIntervalSeconds * 6, 60, 7200);
  // Keep the thresholds ordered: interval < stale < offline.
  if (staleAfterSeconds <= heartbeatIntervalSeconds) staleAfterSeconds = heartbeatIntervalSeconds * 2 + 15;
  if (offlineAfterSeconds <= staleAfterSeconds) offlineAfterSeconds = staleAfterSeconds + heartbeatIntervalSeconds * 2;
  return {
    heartbeatIntervalSeconds,
    staleAfterSeconds,
    offlineAfterSeconds,
    minReportIntervalSeconds: 5,
    sampleBucketSeconds: 300,
    listWindowHours: 24,
    historyRetentionDays: 30,
    serverRetentionDays: 7
  };
}

/** Health from heartbeat age alone — never trusts that a server will announce its own shutdown. */
export function classifyServer(heartbeatAgeSeconds: number, shutdownReported: boolean, cfg: Pick<MonitoringConfig, "staleAfterSeconds" | "offlineAfterSeconds">): ServerHealth {
  if (shutdownReported) return "offline";
  if (heartbeatAgeSeconds <= cfg.staleAfterSeconds) return "online";
  if (heartbeatAgeSeconds <= cfg.offlineAfterSeconds) return "stale";
  return "offline";
}

/** The Critter Factory universe (Roblox GameId). Reuses the existing ROBLOX_UNIVERSE_ID. */
export function getPrimaryUniverseId(env: Env = process.env): number | null {
  const n = Number(env.ROBLOX_UNIVERSE_ID);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
