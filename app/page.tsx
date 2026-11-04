import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth";
import Login from "./ui/login";
import Dashboard from "./ui/dashboard";

export default async function Home() {
  const token = (await cookies()).get("acrn_session")?.value;
  const valid = token ? await verifySession(token) : false;
  if (!valid) return <Login />;
  return <Dashboard />;
}