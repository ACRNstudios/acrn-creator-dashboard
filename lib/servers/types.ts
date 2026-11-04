// Shared types for Server Management (Phase 2: live monitoring).
// These are safe to send to the browser — they never contain secrets.

/** ONLINE: recent heartbeat. STALE: heartbeat overdue. OFFLINE: missing past the timeout (or shutdown reported). */
export type ServerHealth = "online" | "stale" | "offline";

/** public = normal server; private = VIP/private server; reserved = TeleportService reserved server; studio = Studio play test. */
export type ServerType = "public" | "private" | "reserved" | "studio";

export interface MonitoredServer {
  jobId: string;
  placeId: number;
  placeVersion: number;
  serverType: ServerType;
  playerCount: number;
  maxPlayers: number;
  /** ISO timestamp reported by the Roblox server when it started. */
  startedAt: string;
  /** For active servers: now − startedAt. For offline servers: last heartbeat − startedAt. */
  uptimeSeconds: number;
  firstSeenAt: string;
  lastHeartbeatAt: string;
  /** Seconds since the last heartbeat, measured by the database clock. */
  heartbeatAgeSeconds: number;
  status: ServerHealth;
  shutdownReported: boolean;
  /** Roblox exposes no official server-region API, so this is always null. */
  region: null;
}

export interface MonitoringConfigPublic {
  heartbeatIntervalSeconds: number;
  staleAfterSeconds: number;
  offlineAfterSeconds: number;
  listWindowHours: number;
}

export interface PopulationPoint {
  bucketStart: string;
  /** Sum of each server's peak inside the bucket (upper bound of concurrent players). */
  peakPlayers: number;
  /** Sum of each server's average inside the bucket. */
  averagePlayers: number;
  servers: number;
}

export type ActivityKind = "announcement" | "server_detected" | "server_shutdown" | "server_offline";

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  /** ISO timestamp. */
  at: string;
  /** "live" = derived from stored telemetry; "session" = action taken in this browser session (not persisted). */
  source: "live" | "session";
}

export interface MonitoringSnapshot {
  generatedAt: string;
  universeId: number;
  config: MonitoringConfigPublic;
  servers: MonitoredServer[];
  sessions: {
    completed: number;
    /** null until enough completed sessions exist to be meaningful. */
    averageSeconds: number | null;
    minimumForAverage: number;
  };
  history: PopulationPoint[];
  activity: ActivityEvent[];
}

export type SnapshotResult =
  | { ok: true; snapshot: MonitoringSnapshot }
  | { ok: false; code: "not_configured" | "unavailable"; error: string };

/** Non-secret integration status that is safe to send to the browser. */
export interface IntegrationStatus {
  /** True when the Roblox API key and Universe ID are present on the server. Values are never exposed. */
  robloxMessagingConfigured: boolean;
  commandTopic: string;
  databaseConfigured: boolean;
  telemetrySecretConfigured: boolean;
  heartbeatIntervalSeconds: number;
  staleAfterSeconds: number;
  offlineAfterSeconds: number;
}
