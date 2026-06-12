import {
  createToast,
  dismissToast,
  removeExpiredToasts,
  type ToastMessage,
} from "./toast-store";

describe("toast store", () => {
  it("creates success and error messages with ids", () => {
    const success = createToast("success", "Saved successfully.");
    const error = createToast("error", "Save failed.");

    expect(success).toMatchObject({
      type: "success",
      message: "Saved successfully.",
    });
    expect(error).toMatchObject({
      type: "error",
      message: "Save failed.",
    });
    expect(success.id).not.toBe(error.id);
  });

  it("dismisses a toast by id", () => {
    const first = createToast("success", "First");
    const second = createToast("error", "Second");

    expect(dismissToast([first, second], first.id)).toEqual([second]);
  });

  it("removes expired toasts while keeping active ones", () => {
    const messages: ToastMessage[] = [
      {
        id: "expired",
        type: "success",
        message: "Expired",
        createdAt: 1000,
        durationMs: 3000,
      },
      {
        id: "active",
        type: "error",
        message: "Active",
        createdAt: 3000,
        durationMs: 3000,
      },
    ];

    expect(removeExpiredToasts(messages, 4500)).toEqual([messages[1]]);
  });
});
