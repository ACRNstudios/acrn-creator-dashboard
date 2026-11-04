import { formatRelative } from "@/lib/servers/metrics";
import type { ActivityEvent, ActivityKind } from "@/lib/servers/types";
import SourceBadge from "./source-badge";

const ICONS: Record<ActivityKind, string> = {
  announcement: "↗",
  server_detected: "▦",
  server_shutdown: "■",
  server_offline: "!"
};

interface Props {
  sessionEvents: ActivityEvent[];
  liveEvents: ActivityEvent[];
  generatedAt: string | null;
}

export default function ActivityPanel({ sessionEvents, liveEvents, generatedAt }: Props) {
  const empty = !sessionEvents.length && !liveEvents.length;
  return <div className="panel sm-panel">
    <div className="sm-panel-head">
      <div><h3>Recent activity</h3><p className="muted">Server events from telemetry, plus announcements sent from this page (this session only — announcement history is not stored yet).</p></div>
    </div>
    {empty
      ? <p className="muted sm-activity-empty">No activity yet.</p>
      : <ul className="sm-activity">
        {sessionEvents.map(e => <ActivityRow key={e.id} event={e} when={new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} />)}
        {liveEvents.map(e => <ActivityRow key={e.id} event={e} when={generatedAt ? formatRelative(e.at, generatedAt) : ""} />)}
      </ul>}
  </div>;
}

function ActivityRow({ event, when }: { event: ActivityEvent; when: string }) {
  return <li>
    <span className={`sm-activity-icon sm-activity-${event.kind}`}>{ICONS[event.kind]}</span>
    <div className="sm-activity-body">
      <div className="sm-activity-title"><strong>{event.title}</strong><SourceBadge source={event.source} /></div>
      <p>{event.detail}</p>
    </div>
    <time dateTime={event.at}>{when}</time>
  </li>;
}
