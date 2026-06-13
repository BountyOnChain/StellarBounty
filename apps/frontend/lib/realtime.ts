"use client";

import { useEffect, useMemo } from "react";
import { io, type Socket } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type RealtimeEventName =
  | "bounty.created"
  | "bounty.updated"
  | "submission.received"
  | "submission.approved"
  | "submission.rejected"
  | "bounty.completed";

export type RealtimePayload = {
  bountyId: string;
  bountyTitle?: string;
  bountyStatus?: string;
  submissionId?: string;
  submissionStatus?: string;
  ownerAddress?: string;
  contributorAddress?: string;
  occurredAt: string;
};

const REALTIME_EVENTS: RealtimeEventName[] = [
  "bounty.created",
  "bounty.updated",
  "submission.received",
  "submission.approved",
  "submission.rejected",
  "bounty.completed",
];

let socket: Socket | null = null;

function getSocket() {
  if (!socket) {
    socket = io(API_URL, {
      autoConnect: false,
      transports: ["websocket", "polling"],
    });
  }

  return socket;
}

export function useRealtimeNotifications(
  onEvent: (event: RealtimeEventName, payload: RealtimePayload) => void,
  enabled = true,
) {
  const stableEvents = useMemo(() => REALTIME_EVENTS, []);

  useEffect(() => {
    if (!enabled) return;

    const realtimeSocket = getSocket();
    const handlers = stableEvents.map((event) => {
      const handler = (payload: RealtimePayload) => onEvent(event, payload);
      realtimeSocket.on(event, handler);
      return { event, handler };
    });

    if (!realtimeSocket.connected) {
      realtimeSocket.connect();
    }

    return () => {
      handlers.forEach(({ event, handler }) => realtimeSocket.off(event, handler));
    };
  }, [enabled, onEvent, stableEvents]);
}
