"use client";

import { useEffect, useState } from "react";
import { savedKey, saveKey } from "@/lib/hostAuth";
import Board from "./Board";
import PasswordGate from "./PasswordGate";

export default function HostPage() {
  // undefined = not read from sessionStorage yet (avoids a flash of the gate on reload)
  const [key, setKey] = useState<string | null | undefined>(undefined);

  // sessionStorage only exists in the browser, so read it after hydration.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setKey(savedKey()), []);

  if (key === undefined) return null;
  if (!key)
    return (
      <PasswordGate
        onUnlock={(k) => {
          saveKey(k);
          setKey(k);
        }}
      />
    );
  return (
    <Board
      hostKey={key}
      onLogout={() => {
        saveKey(null);
        setKey(null);
      }}
    />
  );
}
