"use client";

import { useState } from "react";

export default function Login() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to sign in.");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-shell">
    <div className="login-card">
      <div className="brand-mark">A</div>
      <p className="eyebrow">ACRN STUDIOS</p>
      <h1>Creator access</h1>
      <p className="muted">Sign in to manage your live experiences.</p>
      <form onSubmit={submit}>
        <label htmlFor="password">Admin password</label>
        <input id="password" type="password" autoComplete="current-password" value={password}
          onChange={e => setPassword(e.target.value)} placeholder="Enter your admin password" required />
        {error && <p className="error">{error}</p>}
        <button className="primary full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
      <p className="fine-print">Private studio dashboard · Authorized access only</p>
    </div>
  </main>;
}