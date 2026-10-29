import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { API_ERROR_CODES, errorMessage } from "./errors";

// Mã lỗi trong bảng "Định dạng lỗi" của docs/api.md: dòng dạng "| `code` | 401 | ... |".
function documentedCodes(): string[] {
  const doc = readFileSync(resolve(__dirname, "../../../../../docs/api.md"), "utf8");
  return [...doc.matchAll(/^\| `([a-z_]+)` \| \d{3} \|/gm)].map((m) => m[1]);
}

describe("error messages", () => {
  it("every documented error code has its own English message", () => {
    const codes = documentedCodes();
    expect(codes.length).toBeGreaterThan(10);
    const generic = errorMessage("definitely_not_a_code");
    for (const code of codes) {
      expect(API_ERROR_CODES, code).toContain(code);
      const msg = errorMessage(code);
      expect(msg, code).not.toBe(generic);
      expect(msg, code).toMatch(/^[\x20-\x7E’]+$/); // chỉ ASCII: không lọt câu tiếng Việt
    }
  });

  it("code list has no stale entries", () => {
    expect([...API_ERROR_CODES].sort()).toEqual([...documentedCodes()].sort());
  });
});
