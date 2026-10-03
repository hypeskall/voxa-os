import { describe, expect, it } from "vitest";
import {
  rescheduleSlotsInputSchema,
  slotsInputSchema,
} from "../src/features/scheduling/model";

const day = {
  window_start: "2026-10-05T00:00:00Z",
  window_end: "2026-10-06T00:00:00Z",
};
const serviceId = "11111111-1111-4111-8111-111111111111";

describe("calendar slot request validation", () => {
  it("accepts a reschedule window without a service ID", () => {
    expect(rescheduleSlotsInputSchema.parse(day)).toEqual({
      ...day,
      step_minutes: 15,
    });
    expect(slotsInputSchema.safeParse(day).success).toBe(false);
  });

  it.each([
    ["empty", day.window_start],
    ["reversed", "2026-10-04T00:00:00Z"],
    ["over 31 days", "2026-11-06T00:00:00Z"],
  ])("rejects a %s window in creation and rescheduling", (_name, end) => {
    const input = { ...day, window_end: end };
    expect(rescheduleSlotsInputSchema.safeParse(input).success).toBe(false);
    expect(slotsInputSchema.safeParse({ ...input, service_id: serviceId }).success).toBe(false);
  });

  it("accepts the 31-day boundary in both flows", () => {
    const input = { ...day, window_end: "2026-11-05T00:00:00Z" };
    expect(rescheduleSlotsInputSchema.safeParse(input).success).toBe(true);
    expect(slotsInputSchema.safeParse({ ...input, service_id: serviceId }).success).toBe(true);
  });

  it("rejects malformed doctor IDs and out-of-range steps in both flows", () => {
    for (const extra of [{ doctor_id: "bad-id" }, { step_minutes: 1 }]) {
      expect(rescheduleSlotsInputSchema.safeParse({ ...day, ...extra }).success).toBe(false);
      expect(slotsInputSchema.safeParse({ ...day, ...extra, service_id: serviceId }).success).toBe(false);
    }
  });
});
