export type ToastType = "success" | "error";

export type ToastMessage = {
  id: string;
  type: ToastType;
  message: string;
  createdAt: number;
  durationMs: number;
};

const DEFAULT_DURATION_MS = 5000;

export function createToast(
  type: ToastType,
  message: string,
  durationMs = DEFAULT_DURATION_MS,
): ToastMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    message,
    createdAt: Date.now(),
    durationMs,
  };
}

export function dismissToast(messages: ToastMessage[], id: string): ToastMessage[] {
  return messages.filter((message) => message.id !== id);
}

export function removeExpiredToasts(
  messages: ToastMessage[],
  now = Date.now(),
): ToastMessage[] {
  return messages.filter((message) => now - message.createdAt < message.durationMs);
}
