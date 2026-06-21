import { describe, it, expect } from "vitest";
import {
  computeDocumentChanges,
  describeDocumentChanges,
  versionsToPrune,
  MAX_DOCUMENT_VERSION_FILES,
  type DocumentFieldsSnapshot,
} from "../branch-document-versions";

const base: DocumentFieldsSnapshot = {
  name: "FSSAI License",
  description: "kitchen license",
  documentTypeId: "dt1",
  renewalDate: new Date("2026-01-01"),
  reminderDate: new Date("2025-12-15"),
};

describe("computeDocumentChanges", () => {
  it("returns no changes when nothing differs and no file", () => {
    expect(computeDocumentChanges(base, { ...base }, false)).toEqual([]);
  });

  it("detects metadata changes", () => {
    const incoming = {
      ...base,
      name: "FSSAI License 2027",
      renewalDate: new Date("2027-01-01"),
    };
    expect(computeDocumentChanges(base, incoming, false)).toEqual(["name", "renewalDate"]);
  });

  it("treats null vs same description as unchanged, and null change as changed", () => {
    expect(computeDocumentChanges(base, { ...base, description: "kitchen license" }, false)).toEqual([]);
    expect(computeDocumentChanges(base, { ...base, description: null }, false)).toEqual(["description"]);
  });

  it("compares dates by value, not identity", () => {
    const incoming = { ...base, renewalDate: new Date("2026-01-01") };
    expect(computeDocumentChanges(base, incoming, false)).toEqual([]);
  });

  it("appends 'file' when the file was replaced", () => {
    expect(computeDocumentChanges(base, { ...base }, true)).toEqual(["file"]);
    expect(computeDocumentChanges(base, { ...base, name: "x" }, true)).toEqual(["name", "file"]);
  });

  it("detects documentType change", () => {
    expect(computeDocumentChanges(base, { ...base, documentTypeId: null }, false)).toEqual(["documentType"]);
  });
});

describe("describeDocumentChanges", () => {
  it("renders friendly labels", () => {
    expect(describeDocumentChanges(["file", "renewalDate"])).toBe("file, renewal date");
  });
});

describe("versionsToPrune", () => {
  const mk = (n: number, opts: Partial<{ filePruned: boolean; fileUrl: string | null }> = {}) => ({
    versionNumber: n,
    filePruned: opts.filePruned ?? false,
    fileUrl: opts.fileUrl === undefined ? `url-${n}` : opts.fileUrl,
  });

  it("prunes nothing when at or under the cap", () => {
    const versions = [mk(1), mk(2), mk(3)];
    expect(versionsToPrune(versions, 5)).toEqual([]);
    expect(versionsToPrune([mk(1), mk(2), mk(3), mk(4), mk(5)], 5)).toEqual([]);
  });

  it("prunes the oldest beyond the cap", () => {
    const versions = [mk(3), mk(1), mk(2), mk(4), mk(5), mk(6)]; // unsorted, 6 files, cap 5
    const pruned = versionsToPrune(versions, 5);
    expect(pruned.map((v) => v.versionNumber)).toEqual([1]); // only the single oldest
  });

  it("ignores already-pruned versions when counting", () => {
    const versions = [
      mk(1, { filePruned: true, fileUrl: null }),
      mk(2, { filePruned: true, fileUrl: null }),
      mk(3),
      mk(4),
      mk(5),
      mk(6),
    ];
    // 4 live files (3..6) under cap 5 → nothing to prune
    expect(versionsToPrune(versions, 5)).toEqual([]);
  });

  it("prunes multiple when far over the cap", () => {
    const versions = [mk(1), mk(2), mk(3), mk(4), mk(5), mk(6), mk(7)];
    expect(versionsToPrune(versions, 5).map((v) => v.versionNumber)).toEqual([1, 2]);
  });

  it("defaults to MAX_DOCUMENT_VERSION_FILES", () => {
    const versions = Array.from({ length: MAX_DOCUMENT_VERSION_FILES + 2 }, (_, i) => mk(i + 1));
    expect(versionsToPrune(versions).map((v) => v.versionNumber)).toEqual([1, 2]);
  });
});
