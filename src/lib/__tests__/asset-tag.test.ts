// src/lib/__tests__/asset-tag.test.ts
import { describe, it, expect } from "vitest";
import { assetTag } from "@/lib/asset-tag";

describe("assetTag", () => {
  it("uses the outlet code + zero-padded numId", () => {
    expect(assetTag("CHD", 42, "Chandivali")).toBe("CHD-0042");
    expect(assetTag("CHD", 7, "Chandivali")).toBe("CHD-0007");
  });
  it("does not truncate numIds with 5+ digits", () => {
    expect(assetTag("CHD", 12345, "Chandivali")).toBe("CHD-12345");
  });
  it("falls back to a 3-letter uppercased code from the name when code is null", () => {
    expect(assetTag(null, 42, "Chandivali")).toBe("CHA-0042");
    expect(assetTag(null, 42, "ab")).toBe("AB-0042"); // shorter names: use what's there
    expect(assetTag("", 42, "Powai West")).toBe("POW-0042"); // empty code → fallback
  });
  it("strips non-alphanumerics from the fallback", () => {
    expect(assetTag(null, 1, "S.V. Road")).toBe("SVR-0001");
  });
});
