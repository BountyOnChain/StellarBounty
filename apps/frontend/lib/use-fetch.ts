"use client";

import { useEffect, useState } from "react";
import { isAbortError } from "./is-abort-error";

type UseFetchOptions = {
  enabled?: boolean;
};

type UseFetchState<T> = {
  data: T | null;
  loading: boolean;
  error: Error | null;
};

export function useFetch<T>(
  url: string,
  { enabled = true }: UseFetchOptions = {},
): UseFetchState<T> {
  const [state, setState] = useState<UseFetchState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!enabled || !url) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    const controller = new AbortController();
    let isActive = true;

    setState({ data: null, loading: true, error: null });

    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Request failed.");
        }

        return (await response.json()) as T;
      })
      .then((data) => {
        if (isActive) {
          setState({ data, loading: false, error: null });
        }
      })
      .catch((error: unknown) => {
        if (isAbortError(error) || !isActive) {
          return;
        }

        const requestError = error instanceof Error ? error : new Error("Request failed.");
        setState({ data: null, loading: false, error: requestError });
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [enabled, url]);

  return state;
}
