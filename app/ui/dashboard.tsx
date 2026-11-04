"use client";

import Link from "next/link";
import { useState } from "react";
import AppShell from "./app-shell";
import { ANNOUNCEMENT_MAX_LENGTH, sendAnnouncement as postAnnouncement } from "@/lib/announcements";

export default function Dashboard() {
  const [announcement, setAnnouncement] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      await postAnnouncement(announcement);
      setStatus("Announcement sent to Roblox. Delivery to live servers is best-effort.");
      setAnnouncement("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Command failed.");
    } finally {
      setBusy(false);
    }
  }

  return <AppShell active="overview" eyebrow="STUDIO CONTROL / EXPERIENCE" title="Creator dashboard">
    <div className="welcome-row">
      <div><p className="eyebrow">YOUR EXPERIENCE</p><h2>Critter Factory</h2><p className="muted">Remote operations and live-game controls.</p></div>
      <span className="status-pill"><i /> Dashboard online</span>
    </div>
    <div className="stats-grid">
      <div className="stat-card"><span className="stat-icon">▣</span><p>EXPERIENCE</p><strong>Critter Factory</strong><small>Connected after setup</small></div>
      <div className="stat-card"><span className="stat-icon">◎</span><p>LIVE PLAYERS</p><strong>—</strong><small>Live player metrics are a later integration</small></div>
      <div className="stat-card"><span className="stat-icon">▤</span><p>ACTIVE SERVERS</p><strong>—</strong><small>Live server metrics are a later integration · <Link href="/servers" className="inline-link">Server Management →</Link></small></div>
    </div>
    <div className="section-heading"><div><p className="eyebrow">LIVE OPERATIONS</p><h2>Server-wide announcement</h2></div><span className="tag">PHASE 1</span></div>
    <div className="panel">
      <div className="panel-heading"><div><h3>Broadcast a message</h3><p className="muted">Send a message to all servers subscribed to the creator command topic.</p></div><span className="icon-box">↗</span></div>
      <form onSubmit={sendAnnouncement}>
        <label htmlFor="announcement">Announcement text</label>
        <textarea id="announcement" maxLength={ANNOUNCEMENT_MAX_LENGTH} value={announcement} onChange={e => setAnnouncement(e.target.value)} placeholder="Example: Double cash is live for the next 15 minutes…" required />
        <div className="form-footer"><span className="muted">{announcement.length}/{ANNOUNCEMENT_MAX_LENGTH} characters</span><button className="primary" disabled={busy || !announcement.trim()}>{busy ? "Sending…" : "Send announcement ↗"}</button></div>
      </form>
      {status && <p className={status.startsWith("Announcement sent") ? "success" : "error"}>{status}</p>}
    </div>
    <div className="section-heading"><div><p className="eyebrow">COMING NEXT</p><h2>Studio tools</h2></div></div>
    <div className="tools-grid">
      <div className="tool-card"><span>✦</span><h3>Global events</h3><p>Start and stop timed events across active servers.</p><small>PHASE 2</small></div>
      <div className="tool-card"><span>♧</span><h3>Critter controls</h3><p>Spawn special critters and manage limited releases.</p><small>PHASE 3</small></div>
      <div className="tool-card"><span>♜</span><h3>Player rewards</h3><p>Grant approved rewards with an audit trail.</p><small>PHASE 3</small></div>
    </div>
  </AppShell>;
}
