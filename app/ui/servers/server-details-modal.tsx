"use client";

import { formatAge, formatDuration, SERVER_TYPE_LABELS, STATUS_LABELS } from "@/lib/servers/metrics";
import type { MonitoredServer, MonitoringConfigPublic } from "@/lib/servers/types";
import Modal from "./modal";

interface Props {
  server: MonitoredServer;
  config: MonitoringConfigPublic;
  onClose: () => void;
}

export default function ServerDetailsModal({ server, config, onClose }: Props) {
  const fields: [string, React.ReactNode][] = [
    ["Server ID (JobId)", <code key="id">{server.jobId}</code>],
    ["Place ID", String(server.placeId)],
    ["Place version", `v${server.placeVersion}`],
    ["Server type", SERVER_TYPE_LABELS[server.serverType]],
    ["Players", `${server.playerCount} / ${server.maxPlayers}`],
    ["Started", new Date(server.startedAt).toLocaleString()],
    ["Uptime", formatDuration(server.uptimeSeconds)],
    ["First reported", new Date(server.firstSeenAt).toLocaleString()],
    ["Last heartbeat", `${new Date(server.lastHeartbeatAt).toLocaleString()} (${formatAge(server.heartbeatAgeSeconds)})`],
    ["Region", "Not available"]
  ];

  let statusNote = `Heartbeats are arriving on schedule (every ~${config.heartbeatIntervalSeconds}s).`;
  if (server.status === "stale") statusNote = `No heartbeat for over ${config.staleAfterSeconds}s. The server may be overloaded, losing connectivity, or shutting down. It will be marked offline after ${config.offlineAfterSeconds}s.`;
  if (server.status === "offline") statusNote = server.shutdownReported
    ? "The server reported a graceful shutdown."
    : `No heartbeat for over ${config.offlineAfterSeconds}s — the server has most likely closed or crashed.`;

  return <Modal title="Server details" eyebrow="LIVE SERVER" onClose={onClose}>
    <div className="sm-detail-badges"><span className={`sm-status sm-status-${server.status}`}><i />{STATUS_LABELS[server.status]}</span><span className="sm-badge sm-badge-live">LIVE</span></div>
    <p className="muted sm-modal-lead">{statusNote}</p>
    <dl className="sm-dl">
      {fields.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
    </dl>
    <p className="muted sm-fineprint">Region is not shown because Roblox provides no official API for a game server&apos;s location.</p>
    <div className="sm-subsection">
      <h3>Server commands</h3>
      <p className="muted">Per-server admin commands (message one server, kick, shutdown) are not connected yet. Server-wide announcements are available from Quick Actions.</p>
    </div>
  </Modal>;
}
