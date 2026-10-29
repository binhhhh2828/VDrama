import { describe, expect, it } from "vitest";
import { episodeTabs } from "./EpisodeSheet";

describe("episodeTabs", () => {
  it("chia khoảng 30 tập như bảng danh sách tập của NetShort", () => {
    expect(episodeTabs(35)).toEqual([
      { from: 1, to: 30 },
      { from: 31, to: 35 },
    ]);
  });

  it("phim ngắn chỉ có một tab", () => {
    expect(episodeTabs(12)).toEqual([{ from: 1, to: 12 }]);
    expect(episodeTabs(30)).toEqual([{ from: 1, to: 30 }]);
  });

  it("không có tập thì không có tab", () => {
    expect(episodeTabs(0)).toEqual([]);
  });

  it("tab cuối đủ 30 tập khi chia hết", () => {
    expect(episodeTabs(60)).toEqual([
      { from: 1, to: 30 },
      { from: 31, to: 60 },
    ]);
  });
});
