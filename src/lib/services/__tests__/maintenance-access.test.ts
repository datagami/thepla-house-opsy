import { describe, it, expect } from "vitest";
import { equipmentWhereForRole, canManageBranch } from "@/lib/maintenance-access";

describe("equipmentWhereForRole", () => {
  it("scopes BRANCH_MANAGER to their own branch", () => {
    expect(equipmentWhereForRole("BRANCH_MANAGER", "b-1")).toEqual({ branchId: "b-1" });
  });

  it("gives MANAGEMENT and HR an unscoped (all-branches) filter", () => {
    expect(equipmentWhereForRole("MANAGEMENT", "b-1")).toEqual({});
    expect(equipmentWhereForRole("HR", null)).toEqual({});
  });

  it("forces an impossible filter for a branch manager with no branch", () => {
    expect(equipmentWhereForRole("BRANCH_MANAGER", null)).toEqual({ branchId: "__none__" });
  });
});

describe("canManageBranch", () => {
  it("lets MANAGEMENT manage any branch", () => {
    expect(canManageBranch("MANAGEMENT", null, "b-9")).toBe(true);
  });
  it("lets a BRANCH_MANAGER manage only their own branch", () => {
    expect(canManageBranch("BRANCH_MANAGER", "b-1", "b-1")).toBe(true);
    expect(canManageBranch("BRANCH_MANAGER", "b-1", "b-2")).toBe(false);
  });
  it("denies HR and EMPLOYEE", () => {
    expect(canManageBranch("HR", null, "b-1")).toBe(false);
    expect(canManageBranch("EMPLOYEE", "b-1", "b-1")).toBe(false);
  });
});
