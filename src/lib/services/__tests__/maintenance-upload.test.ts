import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadMaintenanceFiles } from "@/lib/maintenance-upload";

const uploadImage = vi.fn();
vi.mock("@/lib/azure-storage", () => ({
  AzureStorageService: class {
    uploadImage = uploadImage;
  },
}));

beforeEach(() => {
  uploadImage.mockReset();
  uploadImage.mockImplementation(async (_buf, fileName: string, folder: string) =>
    `https://blob.test/${folder}/${fileName}`
  );
});

describe("uploadMaintenanceFiles", () => {
  it("returns nulls/empties when nothing is supplied", async () => {
    const res = await uploadMaintenanceFiles({}, "eq-1", "b-1");
    expect(res).toEqual({ billUrl: null, photoUrls: [] });
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it("uploads a pdf bill to the bills folder and returns its url", async () => {
    const res = await uploadMaintenanceFiles(
      { bill: { base64: "data:application/pdf;base64,QQ==", contentType: "application/pdf" } },
      "eq-1",
      "b-1"
    );
    expect(res.billUrl).toContain("equipment/b-1/bills/");
    expect(res.billUrl).toMatch(/\.pdf$/);
    expect(uploadImage).toHaveBeenCalledTimes(1);
    expect(Buffer.isBuffer(uploadImage.mock.calls[0][0])).toBe(true);
  });

  it("uploads each photo to the photos folder", async () => {
    const res = await uploadMaintenanceFiles(
      {
        photos: [
          { base64: "data:image/jpeg;base64,QQ==", contentType: "image/jpeg" },
          { base64: "QQ==", contentType: "image/png" },
        ],
      },
      "eq-1",
      "b-1"
    );
    expect(res.photoUrls).toHaveLength(2);
    expect(res.photoUrls[0]).toContain("equipment/b-1/photos/");
    expect(res.photoUrls[0]).toMatch(/\.jpg$/);
    expect(res.photoUrls[1]).toMatch(/\.png$/);
  });
});
