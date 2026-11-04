import type { Metadata } from "next";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { getIntegrationStatus, getMonitoringResult } from "@/lib/servers/provider";
import Login from "../ui/login";
import ServerManagement from "../ui/servers/server-management";

export const metadata: Metadata = { title: "Server Management | ACRN Studios" };

export default async function ServersPage() {
  // Same session check as the Overview page (app/page.tsx).
  const token = (await cookies()).get("acrn_session")?.value;
  const valid = token ? await verifySession(token) : false;
  if (!valid) return <Login />;

  const initialResult = await getMonitoringResult();
  return <ServerManagement initialResult={initialResult} integration={getIntegrationStatus()} />;
}
