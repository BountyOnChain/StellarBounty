"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useRealtimeNotifications } from "@/lib/realtime";

export default function RealtimeBountyRefresh() {
  const router = useRouter();
  const lastRefresh = useRef(0);

  useRealtimeNotifications(
    useCallback(
      (event) => {
        if (!event.startsWith("bounty.") && !event.startsWith("submission.")) {
          return;
        }

        const now = Date.now();
        if (now - lastRefresh.current < 750) {
          return;
        }

        lastRefresh.current = now;
        router.refresh();
      },
      [router],
    ),
  );

  return null;
}
