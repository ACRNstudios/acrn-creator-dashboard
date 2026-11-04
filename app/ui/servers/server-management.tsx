"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActivityEvent, IntegrationStatus, MonitoredServer, MonitoringSnapshot, SnapshotResult } from "@/lib/servers/types";
import AppShell from "../app-shell";
import ActivityPanel from "./activity-panel";
import OverviewCards from "./overview-cards";
import QuickActions from "./quick-actions";
import ServerDetailsModal from "./server-details-modal";
import ServerTable from "./server-table";

const AUTO_REFRESH_MS = 15_000;

interface Props {
  initialResult: SnapshotResult;
  integration: IntegrationStatus;
}

export default function ServerManagement({ initialResult, integration }: Props) {
  const [snapshot, setSnapshot] = useState<MonitoringSnapshot | null>(initialResult.ok ? initialResult.snapshot : null);
  const [error, setError] = useState<{ message: string; notConfigured: boolean } | null>(
    initialResult.ok ? null : { message: initialResult.error, notConfigured: initialResult.code === "not_configured" });
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(initialResult.ok ? initialResult.snapshot.generatedAt : null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sessionEvents, setSessionEvents] = useState<ActivityEvent[]>([]);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      const res = await fetch("/api/servers", { cache: "no-store" });
      if (res.status === 401) {
        setError({ message: "Your session has expired. Reload the page and sign in again.", notConfigured: false });
        setAutoRefresh(false);
        return;
      }
      const data = (await res.json().catch(() => null)) as SnapshotResult | null;
      if (!data) throw new Error("Unexpected response from the dashboard server.");
      if (data.ok) {
        setSnapshot(data.snapshot);
        setLastUpdated(data.snapshot.generatedAt);
        setError(null);
      } else {
        setError({ message: data.error, notConfigured: data.code === "not_configured" });
      }
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : "Could not reach the dashboard server.", notConfigured: false });
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, []);

  // Auto-refresh while the tab is visible.
  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, AUTO_REFRESH_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [autoRefresh, refresh]);

  const recordAnnouncement = useCallback((text: string) => {
    const at = new Date().toISOString();
    setSessionEvents(prev => [{ id: `session-${at}`, kind: "announcement" as const, title: "Announcement sent", detail: `“${text}”`, at, source: "session" as const }, ...prev].slice(0, 10));
  }, []);

  const closeDetails = useCallback(() => setSelectedId(null), []);
  // Keep the open details view in sync with refreshed data.
  const selected: MonitoredServer | null = selectedId ? snapshot?.servers.find(s => s.jobId === selectedId) ?? null : null;

  const live = Boolean(snapshot) && !error;

  return <AppShell active="servers" eyebrow="STUDIO CONTROL / CRITTER FACTORY" title="Server Management" wide>
    <div className="welcome-row">
      <div><p className="eyebrow">YOUR EXPERIENCE</p><h2>Critter Factory</h2><p className="muted">Live server monitoring and live-ops actions.</p></div>
      {live
        ? <span className="status-pill"><i /> Live monitoring</span>
        : <span className="status-pill sm-pill-warn"><i /> {error?.notConfigured ? "Monitoring not configured" : "Monitoring unavailable"}</span>}
    </div>

    {error && <div className={`sm-banner ${error.notConfigured ? "" : "sm-banner-error"}`} role="alert">
      <strong>{error.notConfigured ? "Setup required" : "Couldn’t refresh"}</strong>
      <span>{error.message}{snapshot && !error.notConfigured ? " Showing the last data received." : ""}{error.notConfigured ? " See README → Phase 2 for setup steps." : ""}</span>
    </div>}

    <OverviewCards snapshot={snapshot} loading={refreshing && !snapshot} />

    <div className="sm-grid">
      <div className="sm-main-col">
        <div className="panel sm-panel">
          <div className="sm-panel-head">
            <div>
              <h3>Active servers</h3>
              <p className="muted">
                {lastUpdated ? <>Updated {new Date(lastUpdated).toLocaleTimeString()}</> : "Not loaded"}
                {snapshot && <> · online ≤ {snapshot.config.staleAfterSeconds}s since heartbeat, offline after {snapshot.config.offlineAfterSeconds}s</>}
              </p>
            </div>
            <div className="sm-head-actions">
              <label className="sm-toggle"><input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} /> Auto-refresh {AUTO_REFRESH_MS / 1000}s</label>
              <button className="ghost" onClick={() => void refresh()} disabled={refreshing} aria-busy={refreshing}>
                {refreshing ? <><span className="sm-spinner" aria-hidden /> Refreshing…</> : "↻ Refresh"}
              </button>
            </div>
          </div>
          <ServerTable snapshot={snapshot} loading={refreshing} onSelect={s => setSelectedId(s.jobId)} />
        </div>
      </div>
      <div className="sm-side-col">
        <QuickActions integration={integration} onAnnouncementSent={recordAnnouncement} />
        <ActivityPanel sessionEvents={sessionEvents} liveEvents={snapshot?.activity ?? []} generatedAt={snapshot?.generatedAt ?? null} />
      </div>
    </div>

    {selected && snapshot && <ServerDetailsModal server={selected} config={snapshot.config} onClose={closeDetails} />}
  </AppShell>;
}
