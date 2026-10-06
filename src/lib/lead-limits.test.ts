import { describe, it, expect } from "vitest";
import { getMonthStart, computeLeadVisibility, LISTED_MONTHLY_LEAD_CAP } from "@/lib/lead-limits";

const reqs = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `r${i + 1}` }));

describe("getMonthStart (IST)", () => {
  it("returns midnight IST on the 1st (18:30 UTC the day before)", () => {
    expect(getMonthStart(new Date("2026-10-15T10:00:00Z")).toISOString()).toBe("2026-09-30T18:30:00.000Z");
  });
  it("18:29 UTC on the last day is still the same month in IST", () => {
    expect(getMonthStart(new Date("2026-09-30T18:29:00Z")).toISOString()).toBe("2026-08-31T18:30:00.000Z");
  });
  it("18:30 UTC on the last day is the next month in IST", () => {
    expect(getMonthStart(new Date("2026-09-30T18:30:00Z")).toISOString()).toBe("2026-09-30T18:30:00.000Z");
  });
  it("rolls the year over in December to January", () => {
    expect(getMonthStart(new Date("2026-12-31T18:30:00Z")).toISOString()).toBe("2026-12-31T18:30:00.000Z");
    expect(getMonthStart(new Date("2026-12-31T18:29:00Z")).toISOString()).toBe("2026-11-30T18:30:00.000Z");
  });
  it("January start is in the previous UTC year", () => {
    expect(getMonthStart(new Date("2027-01-10T00:00:00Z")).toISOString()).toBe("2026-12-31T18:30:00.000Z");
  });
});

describe("computeLeadVisibility", () => {
  it("cap is 5", () => {
    expect(LISTED_MONTHLY_LEAD_CAP).toBe(5);
  });
  it("LISTED with 4 leads: all full, cap not reached", () => {
    const v = computeLeadVisibility("LISTED", reqs(4));
    expect([...v.values()].every((x) => x === "full")).toBe(true);
  });
  it("LISTED with exactly 5 leads: all full, none blurred", () => {
    const v = computeLeadVisibility("LISTED", reqs(5));
    expect([...v.values()].filter((x) => x === "blurred")).toHaveLength(0);
  });
  it("LISTED 6th lead is blurred, first 5 stay full", () => {
    const v = computeLeadVisibility("LISTED", reqs(7));
    expect(v.get("r5")).toBe("full");
    expect(v.get("r6")).toBe("blurred");
    expect(v.get("r7")).toBe("blurred");
  });
  it("PLUS and PRO are never blurred", () => {
    for (const t of ["PLUS", "PRO"] as const) {
      const v = computeLeadVisibility(t, reqs(20));
      expect([...v.values()].every((x) => x === "full")).toBe(true);
    }
  });
});
