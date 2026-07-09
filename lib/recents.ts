"use client";

import { useEffect, useState } from "react";

/**
 * Recently-viewed notes, tracked entirely in the browser (localStorage) — a private,
 * per-device "jump back in" list. Not synced, not sent anywhere; it's a convenience for the
 * human at the dashboard, independent of the vault/git. Newest first, deduped by path.
 */
export interface RecentNote {
  path: string;
  title: string;
  folder?: string;
  at: number;
}

const KEY = "engram:recents";
const MAX = 12;
const EVENT = "engram:recents-changed";

export function getRecents(): RecentNote[] {
  if (typeof window === "undefined") return [];
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Record a note as just-viewed (moves it to the front). Fires an event so open lists refresh. */
export function recordView(path: string, title: string, folder?: string): void {
  if (typeof window === "undefined" || !path) return;
  const list = getRecents().filter((r) => r.path !== path);
  list.unshift({ path, title: title || path, folder, at: Date.now() });
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* storage full / disabled — non-fatal */
  }
}

/** Subscribe to the recents list (updates on view + across tabs). */
export function useRecents(): RecentNote[] {
  const [recents, setRecents] = useState<RecentNote[]>([]);
  useEffect(() => {
    const read = () => setRecents(getRecents());
    read();
    window.addEventListener(EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return recents;
}
