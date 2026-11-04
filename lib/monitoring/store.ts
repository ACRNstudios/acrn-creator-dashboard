import { query } from "@/lib/db";
import type { ActivityEvent, MonitoredServer, MonitoringSnapshot, PopulationPoint, ServerType } from "@/lib/servers/types";
import { classifyServer, type MonitoringConfig } from "./config";
import type { HeartbeatPayload } from "./heartbeat";
import {
  LIST_SERVERS_SQL, POPULATION_HISTORY_SQL, PRUNE_SAMPLES_SQL, PRUNE_SERVERS_SQL,
  SESSION_TOTALS_SQL, UPSERT_HEARTBEAT_SQL
} from "./queries";

/** Average session length is hidden until at least this many sessions have completed. */
export const MIN_SESSIONS_FOR_AVERAGE = 5;

export type HeartbeatWriteResult = "created" | "updated" | "rate_limited";

export async function recordHeartbeat(p: HeartbeatPayload, cfg: MonitoringConfig): Promise<HeartbeatWriteResult> {
  const rows = await query<{ inserted: boolean }>(UPSERT_HEARTBEAT_SQL, [
    p.universeId, p.jobId, p.placeId, p.placeVersion, p.serverType, p.playerCount, p.maxPlayers,
    p.startedAt, p.reason, p.sessionsCompleted, p.sessionSecondsTotal,
    cfg.minReportIntervalSeconds, cfg.sampleBucketSeconds
  ]);
  if (!rows.length) return "rate_limited";
  return rows[0].inserted ? "created" : "updated";
}

export async function pruneOldData(cfg: MonitoringConfig): Promise<void> {
  await query(PRUNE_SAMPLES_SQL, [cfg.historyRetentionDays]);
  await query(PRUNE_SERVERS_SQL, [cfg.serverRetentionDays]);
}

interface ServerRow {
  job_id: string;
  place_id: number;
  place_version: number;
  server_type: ServerType;
  player_count: number;
  max_players: number;
  started_at: number;
  first_seen_at: number;
  last_heartbeat_at: number;
  shutdown_reported: boolean;
}

const iso = (unixSeconds: number) => new Date(unixSeconds * 1000).toISOString();
const shortId = (jobId: string) => jobId.length > 13 ? `${jobId.slice(0, 13)}…` : jobId;

export async function loadMonitoringSnapshot(universeId: number, cfg: MonitoringConfig): Promise<MonitoringSnapshot> {
  const params = [universeId, cfg.listWindowHours];
  const [serverRows, totalsRows, historyRows] = await Promise.all([
    query<ServerRow>(LIST_SERVERS_SQL, params),
    query<{ sessions: number; seconds: number; db_now: number }>(SESSION_TOTALS_SQL, params),
    query<{ bucket_start: number; peak_players: number; average_players: number; servers: number }>(POPULATION_HISTORY_SQL, params)
  ]);

  const totals = totalsRows[0] ?? { sessions: 0, seconds: 0, db_now: Date.now() / 1000 };
  const dbNow = Number(totals.db_now);

  const servers: MonitoredServer[] = serverRows.map(r => {
    const lastHeartbeat = Number(r.last_heartbeat_at);
    const startedAt = Number(r.started_at);
    const age = Math.max(0, dbNow - lastHeartbeat);
    const status = classifyServer(age, r.shutdown_reported, cfg);
    const uptimeEnd = status === "offline" ? lastHeartbeat : dbNow;
    return {
      jobId: r.job_id,
      placeId: Number(r.place_id),
      placeVersion: Number(r.place_version),
      serverType: r.server_type,
      playerCount: Number(r.player_count),
      maxPlayers: Number(r.max_players),
      startedAt: iso(startedAt),
      uptimeSeconds: Math.max(0, Math.floor(uptimeEnd - startedAt)),
      firstSeenAt: iso(Number(r.first_seen_at)),
      lastHeartbeatAt: iso(lastHeartbeat),
      heartbeatAgeSeconds: Math.floor(age),
      status,
      shutdownReported: r.shutdown_reported,
      region: null
    };
  });

  const history: PopulationPoint[] = historyRows.map(h => ({
    bucketStart: iso(Number(h.bucket_start)),
    peakPlayers: Number(h.peak_players),
    averagePlayers: Math.round(Number(h.average_players) * 10) / 10,
    servers: Number(h.servers)
  }));

  const sessionsCompleted = Number(totals.sessions);
  return {
    generatedAt: iso(dbNow),
    universeId,
    config: {
      heartbeatIntervalSeconds: cfg.heartbeatIntervalSeconds,
      staleAfterSeconds: cfg.staleAfterSeconds,
      offlineAfterSeconds: cfg.offlineAfterSeconds,
      listWindowHours: cfg.listWindowHours
    },
    servers,
    sessions: {
      completed: sessionsCompleted,
      averageSeconds: sessionsCompleted >= MIN_SESSIONS_FOR_AVERAGE ? Math.round(Number(totals.seconds) / sessionsCompleted) : null,
      minimumForAverage: MIN_SESSIONS_FOR_AVERAGE
    },
    history,
    activity: deriveActivity(servers, cfg)
  };
}

/** Activity derived from stored telemetry only — nothing is invented. */
function deriveActivity(servers: MonitoredServer[], cfg: MonitoringConfig): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  for (const s of servers) {
    events.push({ id: `seen-${s.jobId}`, kind: "server_detected", title: "Server started reporting", detail: `${shortId(s.jobId)} · ${s.serverType}`, at: s.firstSeenAt, source: "live" });
    if (s.shutdownReported) {
      events.push({ id: `down-${s.jobId}`, kind: "server_shutdown", title: "Server shut down", detail: `${shortId(s.jobId)} · reported by server`, at: s.lastHeartbeatAt, source: "live" });
    } else if (s.status === "offline") {
      const at = new Date(new Date(s.lastHeartbeatAt).getTime() + cfg.offlineAfterSeconds * 1000).toISOString();
      events.push({ id: `lost-${s.jobId}`, kind: "server_offline", title: "Server went offline", detail: `${shortId(s.jobId)} · no heartbeat for ${Math.round(cfg.offlineAfterSeconds / 60)} min`, at, source: "live" });
    }
  }
  return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 15);
}
