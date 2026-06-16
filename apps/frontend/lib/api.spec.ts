import { getAuthTokenSubject } from "./api";

function encodeBase64Url(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

describe("getAuthTokenSubject", () => {
  it("returns the JWT subject when present", () => {
    const token = `${encodeBase64Url({ alg: "none", typ: "JWT" })}.${encodeBase64Url({
      sub: "GABC123",
    })}.`;

    expect(getAuthTokenSubject(token)).toBe("GABC123");
  });

  it("returns null for malformed tokens", () => {
    expect(getAuthTokenSubject("not-a-jwt")).toBeNull();
  });
});
