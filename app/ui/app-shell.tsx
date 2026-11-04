"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type NavKey = "overview" | "servers";

interface AppShellProps {
  active: NavKey;
  eyebrow: string;
  title: string;
  wide?: boolean;
  children: ReactNode;
}

// Shared sidebar + top bar used by every signed-in page.
export default function AppShell({ active, eyebrow, title, wide, children }: AppShellProps) {
  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.reload();
  }

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark small">A</span><span>ACRN <b>STUDIOS</b></span></div>
      <div className="side-label">WORKSPACE</div>
      <Link href="/" className={`nav-item${active === "overview" ? " active" : ""}`} aria-current={active === "overview" ? "page" : undefined}>◈ <span>Overview</span></Link>
      <Link href="/servers" className={`nav-item${active === "servers" ? " active" : ""}`} aria-current={active === "servers" ? "page" : undefined}>▦ <span>Server Management</span></Link>
      <div className="nav-item disabled">◷ <span>Events</span><small>PHASE 2</small></div>
      <div className="nav-item disabled">♧ <span>Critters</span><small>PHASE 3</small></div>
      <div className="nav-item disabled">▤ <span>Rewards</span><small>PHASE 3</small></div>
      <div className="nav-item disabled">⚙ <span>Settings</span><small>PLANNED</small></div>
      <div className="sidebar-bottom"><div className="online-dot" /> Creator session active</div>
    </aside>
    <section className="main-area">
      <header className="topbar">
        <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>
        <button className="ghost" onClick={logout}>Sign out ↗</button>
      </header>
      <div className={`content${wide ? " wide" : ""}`}>
        {children}
        <footer>ACRN STUDIOS · PRIVATE CREATOR OPERATIONS</footer>
      </div>
    </section>
  </main>;
}
