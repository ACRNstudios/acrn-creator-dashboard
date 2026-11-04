import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { getMonitoringResult } from "@/lib/servers/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Live server monitoring data for the Server Management page.
// Dashboard administrators only (same session check as /api/command).
export async function GET(req: NextRequest) {
  const token = req.cookies.get("acrn_session")?.value;
  if (!token || !(await verifySession(token))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const result = await getMonitoringResult();
  return NextResponse.json(result, { status: result.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
