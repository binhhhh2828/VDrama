import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps in-site paths", () => {
    expect(safeNext("/series/virtual-city/episode/3")).toBe("/series/virtual-city/episode/3");
    expect(safeNext("/browse?genre=romance")).toBe("/browse?genre=romance");
  });

  it("rejects other sites and odd values", () => {
    for (const bad of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "",
      undefined,
      ["/a"],
    ]) {
      expect(safeNext(bad)).toBe("/");
    }
  });

  it("does not loop back to the auth pages", () => {
    expect(safeNext("/signin")).toBe("/");
    expect(safeNext("/signup?next=/x")).toBe("/");
    expect(safeNext("/signing-bonus")).toBe("/signing-bonus");
  });
});
