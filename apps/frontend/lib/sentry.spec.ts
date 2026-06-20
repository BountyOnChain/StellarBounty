import { scrubSensitiveData } from "./sentry";

describe("scrubSensitiveData", () => {
  it("redacts sensitive keys without removing wallet context", () => {
    expect(scrubSensitiveData({
      request: {
        headers: {
          authorization: "Bearer jwt",
          cookie: "session=secret",
          "x-request-id": "req-123",
        },
        data: {
          signature: "signed-message",
          accessToken: "token",
          walletAddress: "GABC",
        },
      },
    })).toEqual({
      request: {
        headers: {
          authorization: "[Filtered]",
          cookie: "[Filtered]",
          "x-request-id": "req-123",
        },
        data: {
          signature: "[Filtered]",
          accessToken: "[Filtered]",
          walletAddress: "GABC",
        },
      },
    });
  });
});

