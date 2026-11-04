import type { ActivityEvent } from "@/lib/servers/types";

const LABELS: Record<ActivityEvent["source"], string> = {
  live: "LIVE",
  session: "THIS SESSION"
};

export default function SourceBadge({ source }: { source: ActivityEvent["source"] }) {
  return <span className={`sm-badge sm-badge-${source}`}>{LABELS[source]}</span>;
}
