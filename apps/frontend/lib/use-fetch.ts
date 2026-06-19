"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseFetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseFetchOptions {
  enabled?: boolean;
}

export function useFetch<T = unknown>(
  url: string,
  options: UseFetchOptions = {}
): UseFetchState<T> & { refetch: () => void } {
  const { enabled = true } = options;
  const [state, setState] = useState<UseFetchState<T>>({
    data: null,
    loading: false,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const execute = useCallback(() => {
    if (!enabled) return;

    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return res.json() as Promise<T>;
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({ data, loading: false, error: null });
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const message =
          err instanceof Error ? err.message : "Request failed";
        setState({ data: null, loading: false, error: message });
      });
  }, [url, enabled]);

  useEffect(() => {
    execute();
    return () => {
      abortRef.current?.abort();
    };
  }, [execute]);

  return { ...state, refetch: execute };
}
