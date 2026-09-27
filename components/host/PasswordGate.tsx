"use client";

import { useState } from "react";
import { checkPassword } from "@/lib/hostAuth";
import s from "./host.module.css";

export default function PasswordGate({ onUnlock }: { onUnlock: (key: string) => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (await checkPassword(pw)) return onUnlock(pw);
      setError("That's not it.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't check the password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={s.gate}>
      <form className={s.gateCard} onSubmit={submit}>
        <span className="wordmark">
          Beyond the <i>Build</i> · Listener line
        </span>
        <h1>Host board</h1>
        <label className="hint" htmlFor="pw">Password</label>
        <input
          id="pw"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={pw}
          onChange={(e) => {
            setPw(e.target.value);
            setError(null);
          }}
        />
        {error && <div className="error" role="alert">{error}</div>}
        <button className="btn btn-primary" disabled={!pw || busy}>Open board</button>
      </form>
    </main>
  );
}
