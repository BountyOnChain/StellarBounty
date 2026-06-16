"use client";

import { useEffect, useState } from "react";

type UseFetchOptions = {
  enabled?: boolean;
};

type UseFetchState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

export function useFetch<T>(url: string | null, options: UseFetchOptions = {}): UseFetchState<T> {
  const { enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !url) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();

    setLoading(true);
    setError(null);

    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Request failed.");
        }

        return (await response.json()) as T;
      })
      .then((nextData) => {
        setData(nextData);
      })
      .catch((caughtError: unknown) => {
        if (caughtError instanceof DOMException && caughtError.name === "AbortError") {
          return;
        }

        setData(null);
        setError(caughtError instanceof Error ? caughtError.message : "Request failed.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [enabled, url]);

  return { data, loading, error };
}
