// Browser-side helper for the EXISTING announcement endpoint (POST /api/command).
// Shared by the Overview page and the Server Management quick action so there
// is exactly one announcement path. No secrets live here; the API key stays
// on the server inside app/api/command/route.ts.

export const ANNOUNCEMENT_MAX_LENGTH = 180;

export async function sendAnnouncement(text: string): Promise<void> {
  const res = await fetch("/api/command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "announcement", text })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data && typeof data.error === "string" && data.error) || "Command failed.");
}
