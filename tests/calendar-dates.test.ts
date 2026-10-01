import { describe, expect, it } from "vitest";
import { addCalendarMonths, calendarRange } from "../src/features/calendar/model";
import { localDate } from "../src/lib/time";

describe("clinic calendar dates", () => {
  it("uses the clinic day across UTC midnight and daylight-saving changes", () => {
    expect(localDate("Europe/Bucharest", new Date("2026-09-30T22:30:00Z"))).toBe("2026-10-01");
    expect(localDate("Europe/Bucharest", new Date("2026-10-25T22:30:00Z"))).toBe("2026-10-26");
    expect(calendarRange("day", "2026-10-01")).toEqual({ start: "2026-10-01", end: "2026-10-02" });
  });
  it("moves by whole months and clamps dates at the end of a month", () => {
    expect(addCalendarMonths("2026-10-01", 1)).toBe("2026-11-01");
    expect(addCalendarMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addCalendarMonths("2026-01-01", -1)).toBe("2025-12-01");
  });
});
