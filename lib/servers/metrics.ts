import type { MonitoredServer, PopulationPoint } from "./types";

export interface ServerOverview {
  totalPlayers: number;
  /** online + stale */
  activeServers: number;
  onlineServers: number;
  staleServers: number;
  offlineServers: number;
  averageUptimeSeconds: number | null;
  peakPlayers24h: number | null;
}

export function summarizeServers(servers: MonitoredServer[], history: PopulationPoint[]): ServerOverview {
  const active = servers.filter(s => s.status !== "offline");
  return {
    totalPlayers: active.reduce((sum, s) => sum + s.playerCount, 0),
    activeServers: active.length,
    onlineServers: servers.filter(s => s.status === "online").length,
    staleServers: servers.filter(s => s.status === "stale").length,
    offlineServers: servers.filter(s => s.status === "offline").length,
    averageUptimeSeconds: active.length ? Math.round(active.reduce((sum, s) => sum + s.uptimeSeconds, 0) / active.length) : null,
    peakPlayers24h: history.length ? Math.max(...history.map(h => h.peakPlayers)) : null
  };
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${Math.max(0, Math.floor(seconds))}s`;
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatAge(seconds: number): string {
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${Math.floor(seconds)}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/** Relative time of `at` measured against `reference` (ISO strings or ms). */
export function formatRelative(at: string, reference: string | number): string {
  return formatAge(Math.max(0, (new Date(reference).getTime() - new Date(at).getTime()) / 1000));
}

export const SERVER_TYPE_LABELS: Record<MonitoredServer["serverType"], string> = {
  public: "Public",
  private: "Private",
  reserved: "Reserved",
  studio: "Studio test"
};

export const STATUS_LABELS: Record<MonitoredServer["status"], string> = {
  online: "Online",
  stale: "Stale",
  offline: "Offline"
};
