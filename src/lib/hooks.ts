"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "./client";
import type { HubConfig, Project } from "./types";

/**
 * Minimal data-fetching hook. The hub's pages each own one or two collections,
 * so a cache layer would be more machinery than it's worth — but `reload` lets
 * a page refresh after a mutation without a full navigation.
 */
export function useResource<T>(url: string | null, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(!!url);
  const [error, setError] = useState<string | null>(null);

  // Guards against a slow first request overwriting a newer one.
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    if (!url) {
      setLoading(false);
      return;
    }
    const token = ++requestRef.current;
    setLoading(true);
    try {
      const result = await api.get<T>(url);
      if (token === requestRef.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (token === requestRef.current) setError(errorMessage(err));
    } finally {
      if (token === requestRef.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, setData, loading, error, setError, reload: load };
}

export function useProjects() {
  return useResource<Project[]>("/api/projects", []);
}

/** The provider/model list, loaded once per page. */
export function useHubConfig() {
  const [config, setConfig] = useState<HubConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<HubConfig>("/api/config")
      .then((result) => {
        if (!cancelled) setConfig(result);
      })
      .catch(() => {
        // A missing config just means the picker stays hidden; the server
        // still falls back to its own default provider.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return config;
}

/**
 * Debounced autosave. Returns the current status so the UI can show
 * "Saving…" / "Saved" without each editor re-implementing the timer.
 */
export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export function useAutosave(save: () => Promise<unknown>, delay = 1200) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);
  // Whether an edit is waiting to be written. A separate flag rather than a
  // sentinel value, so a falsy payload still counts as pending.
  const pendingRef = useRef(false);

  // Always call the newest closure, so it sees the current editor state.
  saveRef.current = save;

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = false;
  }, []);

  /** Write now if anything is pending. Safe to call when nothing is. */
  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!pendingRef.current) return;
    pendingRef.current = false;

    setStatus("saving");
    try {
      await saveRef.current();
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }, []);

  const schedule = useCallback(() => {
    pendingRef.current = true;
    setStatus("dirty");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flush(), delay);
  }, [delay, flush]);

  // Don't leave a timer running after the editor unmounts.
  useEffect(() => () => cancel(), [cancel]);

  return { status, setStatus, schedule, flush, cancel };
}
