"use client";

import { useEffect, useState } from "react";

/**
 * Returns a boolean indicating whether the user has requested reduced motion.
 * Respects the `prefers-reduced-motion: reduce` media query.
 *
 * Use this hook to conditionally disable animations, transitions, or
 * scroll-based effects in JavaScript-driven components.
 *
 * @example
 * ```tsx
 * const reducedMotion = useReducedMotion();
 * const className = reducedMotion ? "animate-none" : "animate-spin";
 * ```
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);

    const handler = (event: MediaQueryListEvent) => {
      setReduced(event.matches);
    };

    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reduced;
}