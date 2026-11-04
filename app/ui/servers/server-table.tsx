"use client";

import { useMemo, useState } from "react";
import { formatAge, formatDuration, SERVER_TYPE_LABELS, STATUS_LABELS } from "@/lib/servers/metrics";
import type { MonitoredServer, MonitoringSnapshot, ServerHealth, ServerType } from "@/lib/servers/types";

const PAGE_SIZE = 10;
type StatusFilter = "active" | "all" | ServerHealth;

interface ServerTableProps {
  snapshot: MonitoringSnapshot | null;
  loading: boolean;
  onSelect: (server: MonitoredServer) => void;
}

export default function ServerTable({ snapshot, loading, onSelect }: ServerTableProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [type, setType] = useState<"all" | ServerType>("all");
  const [page, setPage] = useState(1);

  const servers = useMemo(() => snapshot?.servers ?? [], [snapshot]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return servers.filter(s =>
      (status === "all" || (status === "active" ? s.status !== "offline" : s.status === status)) &&
      (type === "all" || s.serverType === type) &&
      (!q || s.jobId.includes(q) || String(s.placeId).includes(q)));
  }, [servers, query, status, type]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const firstShown = filtered.length ? (current - 1) * PAGE_SIZE + 1 : 0;

  let emptyMessage: React.ReactNode = null;
  if (!snapshot) emptyMessage = loading ? "Loading servers…" : "Server data is unavailable.";
  else if (!servers.length) emptyMessage = <>No Roblox servers have reported in the last {snapshot.config.listWindowHours} hours.<br /><span className="muted">Servers appear here within one heartbeat ({snapshot.config.heartbeatIntervalSeconds}s) of starting once ACRNServerMonitor is installed and published.</span></>;
  else if (!filtered.length) emptyMessage = status === "active" && !query && type === "all"
    ? "No active servers right now. Choose “All statuses” to see servers that went offline recently."
    : "No servers match these filters.";

  return <>
    <div className="sm-filters">
      <input className="sm-input" type="search" placeholder="Search JobId or Place ID…" aria-label="Search servers" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} />
      <select className="sm-input" aria-label="Filter by status" value={status} onChange={e => { setStatus(e.target.value as StatusFilter); setPage(1); }}>
        <option value="active">Active (online + stale)</option>
        <option value="all">All statuses</option>
        <option value="online">Online</option>
        <option value="stale">Stale</option>
        <option value="offline">Offline</option>
      </select>
      <select className="sm-input" aria-label="Filter by server type" value={type} onChange={e => { setType(e.target.value as "all" | ServerType); setPage(1); }}>
        <option value="all">All server types</option>
        {(Object.keys(SERVER_TYPE_LABELS) as ServerType[]).map(t => <option key={t} value={t}>{SERVER_TYPE_LABELS[t]}</option>)}
      </select>
    </div>

    <div className="sm-table-wrap">
      <table className="sm-table">
        <thead><tr><th>Server ID</th><th>Players</th><th>Uptime</th><th>Status</th><th>Type</th><th>Last heartbeat</th><th aria-label="Actions">Actions</th></tr></thead>
        <tbody>
          {rows.map(s => <tr key={s.jobId}>
            <td><code title={s.jobId}>{s.jobId.slice(0, 13)}…</code></td>
            <td><div className="sm-players"><span>{s.playerCount}/{s.maxPlayers}</span><i><b style={{ width: `${Math.min(100, Math.round((s.playerCount / s.maxPlayers) * 100))}%` }} /></i></div></td>
            <td>{formatDuration(s.uptimeSeconds)}</td>
            <td><span className={`sm-status sm-status-${s.status}`}><i />{STATUS_LABELS[s.status]}</span></td>
            <td><span className={`sm-type sm-type-${s.serverType}`}>{SERVER_TYPE_LABELS[s.serverType]}</span></td>
            <td title={new Date(s.lastHeartbeatAt).toLocaleString()}>{formatAge(s.heartbeatAgeSeconds)}</td>
            <td><button className="ghost sm-row-btn" onClick={() => onSelect(s)}>Details</button></td>
          </tr>)}
          {emptyMessage && <tr><td colSpan={7} className="sm-empty">{emptyMessage}</td></tr>}
        </tbody>
      </table>
    </div>

    <div className="sm-pagination">
      <span className="muted">{filtered.length ? `Showing ${firstShown}–${firstShown + rows.length - 1} of ${filtered.length}` : "0 results"}</span>
      <div>
        <button className="ghost" onClick={() => setPage(current - 1)} disabled={current <= 1}>← Prev</button>
        <span className="sm-page">Page {current} / {pageCount}</span>
        <button className="ghost" onClick={() => setPage(current + 1)} disabled={current >= pageCount}>Next →</button>
      </div>
    </div>
  </>;
}
