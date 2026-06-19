import "@testing-library/jest-dom";

// Polyfill fetch globals for jsdom 20 (Response/Request don't ship by default)
// Use undici-style polyfill via the global Response if absent.
if (typeof globalThis.Response === "undefined") {
  // Minimal Response polyfill for our test use (status + json()).
  class TestResponse {
    body: any;
    status: number;
    constructor(body: any, init?: { status?: number }) {
      this.body = body;
      this.status = init?.status ?? 200;
    }
    async json() {
      return typeof this.body === "string" ? JSON.parse(this.body) : this.body;
    }
  }
  // @ts-ignore
  globalThis.Response = TestResponse;
}
