import { describe, expect, it } from "vitest";
import { highlight } from "./highlight";

describe("highlight", () => {
  it("tô phần khớp, không phân biệt hoa thường", () => {
    expect(highlight("Virtual City", "virt")).toEqual([
      { text: "Virt", match: true },
      { text: "ual City", match: false },
    ]);
  });

  it("khớp không dấu với chữ có dấu và giữ nguyên chữ gốc", () => {
    expect(highlight("Bạch Dã Xà", "bach")).toEqual([
      { text: "Bạch", match: true },
      { text: " Dã Xà", match: false },
    ]);
    expect(highlight("Đường đua", "duong")).toEqual([
      { text: "Đường", match: true },
      { text: " đua", match: false },
    ]);
  });

  it("tô từng từ của từ khóa, kể cả khi xuất hiện nhiều lần", () => {
    const parts = highlight("Love again, love anew", "love new");
    expect(parts.filter((p) => p.match).map((p) => p.text)).toEqual(["Love", "love", "new"]);
  });

  it("từ khóa rỗng hoặc không khớp thì trả nguyên văn", () => {
    expect(highlight("Love Again", "")).toEqual([{ text: "Love Again", match: false }]);
    expect(highlight("Love Again", "zzz")).toEqual([{ text: "Love Again", match: false }]);
  });

  it("ghép lại đúng bằng văn bản gốc", () => {
    const text = "Memories of You";
    expect(
      highlight(text, "mem you")
        .map((p) => p.text)
        .join(""),
    ).toBe(text);
  });
});
