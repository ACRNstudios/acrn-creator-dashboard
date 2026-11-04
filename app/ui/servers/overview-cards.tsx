import { formatDuration, summarizeServers } from "@/lib/servers/metrics";
import type { MonitoringSnapshot } from "@/lib/servers/types";

export default function OverviewCards({ snapshot, loading }: { snapshot: MonitoringSnapshot | null; loading: boolean }) {
  if (!snapshot) {
    const labels = ["TOTAL PLAYERS", "ACTIVE SERVERS", "SERVER UPTIME", "AVERAGE SESSION"];
    return <div className="sm-stats">
      {labels.map(l => <div className="stat-card sm-stat" key={l}>
        <p>{l}</p>
        <strong className={loading ? "sm-skeleton" : undefined}>{loading ? " " : "—"}</strong>
        <small>{loading ? "Loading…" : "Unavailable"}</small>
      </div>)}
    </div>;
  }

  const o = summarizeServers(snapshot.servers, snapshot.history);
  const s = snapshot.sessions;
  const cards = [
    { icon: "◎", label: "TOTAL PLAYERS", value: o.totalPlayers.toLocaleString("en-US"),
      note: o.peakPlayers24h === null ? "Across active servers" : `Across active servers · 24h peak ≈ ${o.peakPlayers24h}` },
    { icon: "▦", label: "ACTIVE SERVERS", value: String(o.activeServers),
      note: o.staleServers ? `${o.onlineServers} online · ${o.staleServers} stale` : `${o.offlineServers} offline in last ${snapshot.config.listWindowHours}h` },
    { icon: "◷", label: "SERVER UPTIME", value: formatDuration(o.averageUptimeSeconds),
      note: o.averageUptimeSeconds === null ? "No active servers" : "Average uptime of active servers" },
    { icon: "⧗", label: "AVERAGE SESSION", value: s.averageSeconds === null ? "Not enough data" : formatDuration(s.averageSeconds),
      note: s.averageSeconds === null
        ? `${s.completed} of ${s.minimumForAverage} completed sessions needed`
        : `From ${s.completed.toLocaleString("en-US")} completed sessions (last ${snapshot.config.listWindowHours}h servers)` }
  ];
  return <div className="sm-stats">
    {cards.map(c => <div className="stat-card sm-stat" key={c.label}>
      <div className="sm-stat-top"><span className="stat-icon">{c.icon}</span><span className="sm-badge sm-badge-live">LIVE</span></div>
      <p>{c.label}</p>
      <strong className={c.value === "Not enough data" ? "sm-stat-muted" : undefined}>{c.value}</strong>
      <small>{c.note}</small>
    </div>)}
  </div>;
}
