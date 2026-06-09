import { describe, it, expect } from "vitest";
import { hasAccess } from "@/lib/access-control";

describe("equipment features", () => {
  it("lets BRANCH_MANAGER, HR, MANAGEMENT view", () => {
    for (const r of ["BRANCH_MANAGER", "HR", "MANAGEMENT"]) {
      expect(hasAccess(r, "equipment.view")).toBe(true);
    }
    expect(hasAccess("EMPLOYEE", "equipment.view")).toBe(false);
  });

  it("lets only BRANCH_MANAGER + MANAGEMENT manage / log / snooze", () => {
    for (const f of ["equipment.manage", "equipment.records.create", "equipment.snooze"] as const) {
      expect(hasAccess("BRANCH_MANAGER", f)).toBe(true);
      expect(hasAccess("MANAGEMENT", f)).toBe(true);
      expect(hasAccess("HR", f)).toBe(false);
      expect(hasAccess("EMPLOYEE", f)).toBe(false);
    }
  });
});
