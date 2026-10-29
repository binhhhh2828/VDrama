import { describe, expect, it } from "vitest";
import {
  formatClock,
  formatDate,
  formatDuration,
  isFinished,
  progressRatio,
  seriesMeta,
  timeLeft,
} from "./format";

describe("format", () => {
  it("formats durations", () => {
    expect(formatDuration(1297)).toBe("22 min");
    expect(formatDuration(20)).toBe("1 min");
    expect(formatDuration(3725)).toBe("1 h 2 min");
    expect(formatDuration(3600)).toBe("1 h");
    expect(formatDuration(null)).toBe("");
  });

  it("formats player clock", () => {
    expect(formatClock(75)).toBe("1:15");
    expect(formatClock(3725)).toBe("1:02:05");
    expect(formatClock(-3)).toBe("0:00");
  });

  it("computes progress and finished state", () => {
    expect(progressRatio(750, 1500)).toBe(0.5);
    expect(progressRatio(2000, 1500)).toBe(1);
    expect(progressRatio(10, null)).toBe(0);
    expect(isFinished(1430, 1500)).toBe(true);
    expect(isFinished(1475, 1500)).toBe(true);
    expect(isFinished(600, 1500)).toBe(false);
    expect(timeLeft(780, 1500)).toBe("12 min left");
    expect(timeLeft(1490, 1500)).toBe("Watched");
  });

  it("builds series meta and dates", () => {
    expect(seriesMeta({ total_episodes: 12, genres: [{ name: "Romance" }] })).toBe(
      "12 episodes · Romance",
    );
    expect(seriesMeta({ total_episodes: null, genres: [] })).toBe("");
    expect(formatDate("2026-11-28T23:30:00Z")).toBe("Nov 28, 2026");
  });
});
