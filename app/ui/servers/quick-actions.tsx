"use client";

import { useCallback, useState } from "react";
import { ANNOUNCEMENT_MAX_LENGTH, sendAnnouncement } from "@/lib/announcements";
import type { IntegrationStatus } from "@/lib/servers/types";
import Modal from "./modal";

type ActionKey = "send" | "schedule" | "settings";

interface Props {
  integration: IntegrationStatus;
  onAnnouncementSent: (text: string) => void;
}

export default function QuickActions({ integration, onAnnouncementSent }: Props) {
  const [open, setOpen] = useState<ActionKey | null>(null);
  const close = useCallback(() => setOpen(null), []);

  const actions: { key: ActionKey; icon: string; title: string; text: string; tag: string }[] = [
    { key: "send", icon: "↗", title: "Send announcement", text: "Broadcast a message to every Critter Factory server.", tag: "LIVE" },
    { key: "schedule", icon: "◷", title: "Schedule announcement", text: "Plan a message for later. Automatic sending is not built yet.", tag: "PLANNED" },
    { key: "settings", icon: "⚙", title: "Manage server settings", text: "View connection status and upcoming server controls.", tag: "READ-ONLY" }
  ];

  return <div className="panel sm-panel">
    <div className="sm-panel-head"><div><h3>Quick actions</h3><p className="muted">Common live-operations tasks.</p></div></div>
    <div className="sm-actions">
      {actions.map(a => <button key={a.key} className="sm-action" onClick={() => setOpen(a.key)}>
        <span className="icon-box">{a.icon}</span>
        <span className="sm-action-text"><strong>{a.title}</strong><small>{a.text}</small></span>
        <em className={a.tag === "LIVE" ? "sm-tag-live" : undefined}>{a.tag}</em>
      </button>)}
    </div>
    {open === "send" && <SendAnnouncementModal integration={integration} onClose={close} onSent={onAnnouncementSent} />}
    {open === "schedule" && <ScheduleAnnouncementModal onClose={close} />}
    {open === "settings" && <ServerSettingsModal integration={integration} onClose={close} />}
  </div>;
}

function SendAnnouncementModal({ integration, onClose, onSent }: { integration: IntegrationStatus; onClose: () => void; onSent: (text: string) => void }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      const sent = text.trim();
      await sendAnnouncement(sent);
      onSent(sent);
      setOk(true);
      setStatus("Announcement sent to Roblox. Delivery to live servers is best-effort.");
      setText("");
    } catch (err) {
      setOk(false);
      setStatus(err instanceof Error ? err.message : "Command failed.");
    } finally {
      setBusy(false);
    }
  }

  return <Modal title="Send announcement" eyebrow="QUICK ACTION" onClose={onClose}>
    <p className="muted sm-modal-lead">Uses the same announcement system as the Overview page. Message goes to all servers subscribed to <code>{integration.commandTopic}</code>.</p>
    {!integration.robloxMessagingConfigured && <p className="sm-note">Roblox connection is not configured on the server, so sending will fail until ROBLOX_API_KEY and ROBLOX_UNIVERSE_ID are set.</p>}
    <form className="sm-form" onSubmit={submit}>
      <label htmlFor="qa-announcement">Announcement text</label>
      <textarea id="qa-announcement" className="sm-input" maxLength={ANNOUNCEMENT_MAX_LENGTH} value={text} onChange={e => setText(e.target.value)} placeholder="Example: Double cash is live for the next 15 minutes…" required autoFocus />
      <div className="form-footer"><span className="muted">{text.length}/{ANNOUNCEMENT_MAX_LENGTH} characters</span><button className="primary" disabled={busy || !text.trim()}>{busy ? "Sending…" : "Send announcement ↗"}</button></div>
    </form>
    {status && <p className={ok ? "success" : "error"}>{status}</p>}
  </Modal>;
}

function ScheduleAnnouncementModal({ onClose }: { onClose: () => void }) {
  return <Modal title="Schedule announcement" eyebrow="PLANNED · NOT ACTIVE" onClose={onClose}>
    <p className="sm-note">Scheduling is not implemented yet. Nothing entered here is saved or sent. This preview shows the planned layout; use “Send announcement” to broadcast now.</p>
    <form className="sm-form" onSubmit={e => e.preventDefault()}>
      <label htmlFor="sch-text">Announcement text</label>
      <textarea id="sch-text" className="sm-input" maxLength={ANNOUNCEMENT_MAX_LENGTH} placeholder="Example: Weekend event starts in 10 minutes!" disabled />
      <div className="sm-form-row">
        <div><label htmlFor="sch-date">Date</label><input id="sch-date" type="date" className="sm-input" disabled /></div>
        <div><label htmlFor="sch-time">Time</label><input id="sch-time" type="time" className="sm-input" disabled /></div>
        <div><label htmlFor="sch-repeat">Repeat</label><select id="sch-repeat" className="sm-input" disabled><option>Does not repeat</option></select></div>
      </div>
      <div className="form-footer"><span className="muted">Requires a server-side scheduler (planned).</span><button className="primary" type="button" disabled>Scheduling unavailable</button></div>
    </form>
  </Modal>;
}

function ServerSettingsModal({ integration, onClose }: { integration: IntegrationStatus; onClose: () => void }) {
  const rows: [string, string, boolean][] = [
    ["Roblox messaging connection", integration.robloxMessagingConfigured ? "Configured" : "Not configured", integration.robloxMessagingConfigured],
    ["Command topic", integration.commandTopic, true],
    ["Monitoring database", integration.databaseConfigured ? "Configured" : "Not configured", integration.databaseConfigured],
    ["Telemetry secret", integration.telemetrySecretConfigured ? "Configured" : "Not configured", integration.telemetrySecretConfigured],
    ["Heartbeat interval", `${integration.heartbeatIntervalSeconds}s`, true],
    ["Stale after / offline after", `${integration.staleAfterSeconds}s / ${integration.offlineAfterSeconds}s`, true],
    ["Supported commands", "Server-wide announcement", true]
  ];
  const planned = ["Maintenance message", "Per-server announcements", "Targeted admin commands", "Server size preferences"];

  return <Modal title="Server settings" eyebrow="QUICK ACTION · READ-ONLY" onClose={onClose}>
    <p className="muted sm-modal-lead">Current connection status. Secret values are never shown in the browser. Timing is set with server environment variables.</p>
    <dl className="sm-dl">
      {rows.map(([k, v, good]) => <div key={k}><dt>{k}</dt><dd><span className={`sm-status ${good ? "sm-status-online" : "sm-status-offline"}`}><i />{v}</span></dd></div>)}
    </dl>
    <div className="sm-subsection">
      <h3>Planned settings</h3>
      <ul className="sm-planned">{planned.map(p => <li key={p}>{p}<em>PLANNED</em></li>)}</ul>
    </div>
  </Modal>;
}
