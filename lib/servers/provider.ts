import { isDatabaseConfigured } from "@/lib/db";
import { isTelemetrySecretConfigured } from "@/lib/monitoring/auth";
import { getMonitoringConfig, getPrimaryUniverseId } from "@/lib/monitoring/config";
import { loadMonitoringSnapshot } from "@/lib/monitoring/store";
import type { IntegrationStatus, SnapshotResult } from "./types";

// Server-side only. Single entry point for Server Management data.
// Phase 2: live telemetry stored in Neon Postgres. There is no demo fallback —
// when storage is missing or failing the UI shows that state instead of fake data.
export async function getMonitoringResult(): Promise<SnapshotResult> {
  const universeId = getPrimaryUniverseId();
  if (universeId === null) return { ok: false, code: "not_configured", error: "ROBLOX_UNIVERSE_ID is not configured on the dashboard server." };
  if (!isDatabaseConfigured()) return { ok: false, code: "not_configured", error: "DATABASE_URL is not configured. Connect Neon Postgres to enable live monitoring." };
  try {
    return { ok: true, snapshot: await loadMonitoringSnapshot(universeId, getMonitoringConfig()) };
  } catch (err) {
    console.error("[monitoring] snapshot failed:", err);
    return { ok: false, code: "unavailable", error: "Could not load server data from the database." };
  }
}

/** Returns only booleans, numbers and non-secret names. Never return env values for keys or secrets. */
export function getIntegrationStatus(): IntegrationStatus {
  const cfg = getMonitoringConfig();
  return {
    robloxMessagingConfigured: Boolean(process.env.ROBLOX_API_KEY && process.env.ROBLOX_UNIVERSE_ID),
    commandTopic: process.env.ROBLOX_COMMAND_TOPIC || "ACRN_Creator_Commands",
    databaseConfigured: isDatabaseConfigured(),
    telemetrySecretConfigured: isTelemetrySecretConfigured(),
    heartbeatIntervalSeconds: cfg.heartbeatIntervalSeconds,
    staleAfterSeconds: cfg.staleAfterSeconds,
    offlineAfterSeconds: cfg.offlineAfterSeconds
  };
}
