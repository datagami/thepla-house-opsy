import { describe, it, expect } from "vitest";
import { fileMatchesAccept } from "@/components/ui/file-dropzone";

function f(name: string, type: string): File {
  return new File([new Uint8Array([1])], name, { type });
}

describe("fileMatchesAccept", () => {
  it("accepts everything when accept is empty/undefined", () => {
    expect(fileMatchesAccept(f("a.bin", "application/octet-stream"))).toBe(true);
    expect(fileMatchesAccept(f("a.bin", "application/octet-stream"), "")).toBe(true);
  });
  it("matches a mime glob (image/*)", () => {
    expect(fileMatchesAccept(f("p.png", "image/png"), "image/*")).toBe(true);
    expect(fileMatchesAccept(f("d.pdf", "application/pdf"), "image/*")).toBe(false);
  });
  it("matches by extension (.xlsx) regardless of mime", () => {
    expect(fileMatchesAccept(f("data.xlsx", ""), ".xlsx")).toBe(true);
    expect(fileMatchesAccept(f("data.XLSX", ""), ".xlsx")).toBe(true); // case-insensitive
    expect(fileMatchesAccept(f("data.csv", "text/csv"), ".xlsx")).toBe(false);
  });
  it("matches an exact mime (application/pdf)", () => {
    expect(fileMatchesAccept(f("d.pdf", "application/pdf"), "application/pdf")).toBe(true);
    expect(fileMatchesAccept(f("p.png", "image/png"), "application/pdf")).toBe(false);
  });
  it("matches any token in a comma list", () => {
    const accept = "application/pdf,image/*";
    expect(fileMatchesAccept(f("d.pdf", "application/pdf"), accept)).toBe(true);
    expect(fileMatchesAccept(f("p.jpg", "image/jpeg"), accept)).toBe(true);
    expect(fileMatchesAccept(f("s.xlsx", ""), accept)).toBe(false);
  });
});
