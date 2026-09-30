import { describe, expect, it } from "vitest";
import {
  calendarScale,
  clockToMinutes,
  minutesToClock,
  snapToIncrement,
  timeOptions,
} from "../src/features/calendar/time-grid";

describe("configurable calendar time grid", () => {
  const config = { incrementMinutes: 15, visibleStart: "08:00", visibleEnd: "20:00" };

  it("keeps clinic hours independent from service duration", () => {
    expect(calendarScale(config)).toMatchObject({ startMinute: 480, endMinute: 1200, slotCount: 48 });
  });

  it("generates quarter-hour starts without adding the closing boundary", () => {
    const values = timeOptions(config);
    expect(values.slice(0, 5)).toEqual(["08:00", "08:15", "08:30", "08:45", "09:00"]);
    expect(values.at(-1)).toBe("19:45");
  });

  it("supports ten-minute scheduling increments", () => {
    expect(timeOptions({ ...config, incrementMinutes: 10 }).slice(0, 4)).toEqual(["08:00", "08:10", "08:20", "08:30"]);
  });

  it("snaps drag and resize changes to the configured increment", () => {
    expect(snapToIncrement(22, 15)).toBe(15);
    expect(snapToIncrement(23, 15)).toBe(30);
  });

  it("formats and parses clinic wall-clock values consistently", () => {
    expect(clockToMinutes("10:45:00")).toBe(645);
    expect(minutesToClock(645)).toBe("10:45");
  });
});
