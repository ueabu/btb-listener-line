const HASH = (process.env.NEXT_PUBLIC_HOST_PASSWORD_HASH ?? "").toLowerCase();
const STORE = "ll-host-key";

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Client-side gate. This only keeps casual visitors off the page; the Apps Script
 * checks the same password (HOST_KEY) on every host call, which is what protects the clips.
 * With no hash configured (local dev), any non-empty password is accepted.
 */
export async function checkPassword(pw: string): Promise<boolean> {
  if (!pw) return false;
  if (!HASH) return true;
  // crypto.subtle only exists on https:// or localhost.
  if (!crypto?.subtle) throw new Error("Open the board over https:// (or localhost) to sign in.");
  return (await sha256(pw)) === HASH;
}

export function savedKey(): string | null {
  try {
    return sessionStorage.getItem(STORE);
  } catch {
    return null;
  }
}

export function saveKey(pw: string | null) {
  try {
    if (pw) sessionStorage.setItem(STORE, pw);
    else sessionStorage.removeItem(STORE);
  } catch {}
}
